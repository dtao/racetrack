//= require lib/codemirror/lib/codemirror
//= require lib/codemirror/mode/javascript/javascript
//= require lib/underscore/underscore
//= require lib/lodash/dist/lodash
//= require lib/benchmark/benchmark
//= require lib/lazy.js/lazy
//= require lib/lazy.js/lazy.dom

var lodash = _.noConflict();

window.addEventListener('load', function() {
  Benchmark.options.maxTime = 1.0;

  var results  = document.querySelector('table#results tbody'),
      progress = document.getElementById('progress');

  function createEditor(containerId) {
    var container = document.getElementById(containerId),
        textarea  = container.querySelector('textarea');

    return CodeMirror.fromTextArea(textarea, {
      mode: 'javascript',
      lineNumbers: true
    });
  }

  var setupEditor      = createEditor('setup'),
      lazyEditor       = createEditor('lazy'),
      underscoreEditor = createEditor('underscore');

  function addBenchmarkToSuite(name, editor, transformer) {
    transformer = transformer || function(code) { return code; };

    return [
      'suite.add("' + name + '", {',
        'setup: function() { ' + setupEditor.getValue() + ' },',
        'fn: function() { ' + transformer(editor.getValue()) + ' }',
      '});'
    ].join('\n');
  }

  document.getElementById('run-benchmarks').addEventListener('click', function() {
    var button = this,
        suite  = new Benchmark.Suite();

    results.innerHTML = '';
    progress.innerHTML = '';

    eval(addBenchmarkToSuite('Underscore', underscoreEditor));
    eval(addBenchmarkToSuite('Lo-Dash', underscoreEditor, function(code) {
      return code.replace(/\b_\b/g, 'lodash');
    }));
    eval(addBenchmarkToSuite('Lazy.js', lazyEditor));

    var cycles    = {},
        topCycles = 0;

    suite.forEach(function(benchmark) {
      benchmark.on('cycle', function() {
        var progressBar = progress.querySelector('.progress-bar[data-benchmark="' + benchmark.name + '"]');

        if (!progressBar) {
          progressBar = document.createElement('DIV');
          progressBar.className = 'progress progress-striped active';
          progress.appendChild(progressBar);

          progressBar = progressBar.appendChild(document.createElement('DIV'));
          progressBar.className = 'progress-bar';
          progressBar.setAttribute('data-benchmark', benchmark.name);

          progressBar.appendChild(document.createElement('SPAN'));
        }

        cycles[benchmark.name] = cycles[benchmark.name] || 0;
        cycles[benchmark.name] += benchmark.count;
        topCycles = Math.max(topCycles, cycles[benchmark.name]);

        progressBar.querySelector('SPAN').innerHTML =
          benchmark.name + ' &times; ' + cycles[benchmark.name];

        Lazy(progress.querySelectorAll('.progress-bar')).each(function(bar) {
          var benchmarkCycles = cycles[bar.getAttribute('data-benchmark')];
          bar.style.width = Math.floor(benchmarkCycles / topCycles * 100) + '%';
        });
      });
    });

    suite.on('cycle', function(e) {
      var benchmark = e.target;

      var currentProgressBar = progress.querySelector('.progress.active');
      currentProgressBar.className = 'progress';

      var resultRow = document.createElement('TR'),
          labelCell = document.createElement('TD'),
          benchCell = document.createElement('TD');

      labelCell.textContent = benchmark.name;
      benchCell.textContent = benchmark.hz.toFixed(3);
      resultRow.appendChild(labelCell);
      resultRow.appendChild(benchCell);
      results.appendChild(resultRow);

      if (results.children.length === 3) {
        setTimeout(function() {
          progress.innerHTML = '';

          new Highcharts.Chart({
            title: {
              text: document.querySelector('input[name="title"]').value
            },
            chart: {
              renderTo: 'chart',
              type: 'bar'
            },
            xAxis: {
              categories: ['Ops/second']
            },
            yAxis: {
              title: false
            },
            series: [
              {
                name: 'Underscore',
                data: [Number(results.children[0].querySelector('td:last-child').textContent)]
              },
              {
                name: 'Lo-Dash',
                data: [Number(results.children[1].querySelector('td:last-child').textContent)]
              },
              {
                name: 'Lazy.js',
                data: [Number(results.children[2].querySelector('td:last-child').textContent)]
              }
            ],
            credits: {
              enabled: false
            }
          });

          button.removeAttribute('disabled');
        }, 1000);
      }
    });

    button.setAttribute('disabled', 'disabled');
    suite.run({ async: true });
  });
});

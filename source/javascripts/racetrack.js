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

  var title            = document.querySelector('input[name="title"]'),
      benchmarksList   = document.querySelector('.saved-benchmarks'),
      setupEditor      = createEditor('setup'),
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

  function formatNumber(number) {
    var parts     = number.toFixed(3).split('.'),
        whole     = parts[0],
        decimal   = parts[1],
        thousands = [];

    while (whole.length >= 3) {
      thousands.unshift(whole.substring(whole.length - 3));
      whole = whole.substring(0, whole.length - 3);
    }

    if (whole.length > 0) {
      thousands.unshift(whole);
    }

    return thousands.join(',') + '.' + decimal;
  }

  function parseNumber(value) {
    return Number(String(value).replace(/,/g, ''));
  }

  function lastCellValue(row) {
    return row.querySelector('td:last-child').textContent;
  }

  function loadSavedBenchmarks() {
    return JSON.parse(localStorage.benchmarks || '[]');
  }

  function populateBenchmarksList(benchmarks) {
    benchmarksList.innerHTML = '';

    Lazy(benchmarks).each(function(benchmark, i) {
      var benchmarkLink = document.createElement('A');
      benchmarkLink.setAttribute('href', 'javascript:void(0);');
      benchmarkLink.setAttribute('data-benchmark', i);
      
      var titleText = document.createTextNode();
      titleText.textContent = benchmark.title;
      benchmarkLink.appendChild(titleText);

      var timestamp = document.createElement('small');
      timestamp.textContent = new Date(benchmark.created).toLocaleString();
      benchmarkLink.appendChild(timestamp);

      benchmarksList.appendChild(benchmarkLink);
    });
  }

  benchmarksList.addEventListener('click', function(e) {
    var benchmarkLink = e.target;

    if (benchmarkLink.nodeName !== 'A') {
      return;
    }

    var benchmarkIndex = benchmarkLink.getAttribute('data-benchmark');
    var benchmark = loadSavedBenchmarks()[benchmarkIndex];

    title.value = benchmark.title;
    setupEditor.setValue(benchmark.setup);
    lazyEditor.setValue(benchmark.lazy);
    underscoreEditor.setValue(benchmark.underscore);
  });

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

        cycles[benchmark.name] = benchmark.count;
        topCycles = Math.max(topCycles, benchmark.count);

        progressBar.querySelector('SPAN').textContent =
          benchmark.name + ': ' + benchmark.count + ' runs';

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
      benchCell.textContent = formatNumber(benchmark.hz);
      resultRow.appendChild(labelCell);
      resultRow.appendChild(benchCell);
      results.appendChild(resultRow);

      if (results.children.length === 3) {
        new Highcharts.Chart({
          title: {
            text: title.value
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
              data: [parseNumber(lastCellValue(results.children[0]))]
            },
            {
              name: 'Lo-Dash',
              data: [parseNumber(lastCellValue(results.children[1]))]
            },
            {
              name: 'Lazy.js',
              data: [parseNumber(lastCellValue(results.children[2]))]
            }
          ],
          credits: {
            enabled: false
          }
        });

        button.removeAttribute('disabled');
      }
    });

    button.setAttribute('disabled', 'disabled');
    suite.run({ async: true });
  });

  document.getElementById('save-benchmarks').addEventListener('click', function() {
    var data = {
      title: title.value,
      setup: setupEditor.getValue(),
      lazy: lazyEditor.getValue(),
      underscore: underscoreEditor.getValue(),
      created: new Date().getTime()
    };

    var benchmarks = loadSavedBenchmarks();
    benchmarks.push(data);
    localStorage.benchmarks = JSON.stringify(benchmarks);

    populateBenchmarksList(benchmarks);
  });

  populateBenchmarksList(loadSavedBenchmarks());
});

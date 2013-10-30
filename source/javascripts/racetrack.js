var lodash = _.noConflict();

window.addEventListener('load', function() {
  Benchmark.options.maxTime = 1.0;

  var results  = document.querySelector('table#results tbody'),
      progress = document.getElementById('progress'),
      chart    = document.getElementById('chart');

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
      underscoreEditor = createEditor('underscore'),
      newButton        = document.getElementById('new-benchmark'),
      runButton        = document.getElementById('run-benchmarks'),
      saveButton       = document.getElementById('save-benchmarks');

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

  function getLastCellValue(row) {
    if (!row) {
      return null;
    }

    return parseNumber(row.querySelector('td:last-child').textContent);
  }

  function setLastCellValue(row, value) {
    row.querySelector('td:last-child').textContent = value;
  }

  function loadSavedBenchmarks() {
    return JSON.parse(localStorage.benchmarks || '[]');
  }

  function saveBenchmarks(benchmarks, title) {
    localStorage.benchmarks = JSON.stringify(benchmarks);
    populateBenchmarksList(benchmarks);

    if (title) {
      highlightBenchmark(title);
    }
  }

  function deleteBenchmark(benchmarkIndex) {
    benchmarkIndex = Number(benchmarkIndex);

    var benchmarks = loadSavedBenchmarks();
    benchmarks.splice(benchmarkIndex, 1);
    saveBenchmarks(benchmarks);
  }

  function populateBenchmarksList(benchmarks) {
    benchmarksList.innerHTML = '';

    Lazy(benchmarks).each(function(benchmark, i) {
      var benchmarkLink = document.createElement('A');
      benchmarkLink.setAttribute('href', 'javascript:void(0);');
      benchmarkLink.setAttribute('data-benchmark', i);

      var deleteButton = document.createElement('SPAN');
      deleteButton.className = 'delete';
      benchmarkLink.appendChild(deleteButton);

      var titleText = document.createElement('SPAN');
      titleText.className = 'title';
      titleText.textContent = benchmark.title;
      benchmarkLink.appendChild(titleText);

      var timestamp = document.createElement('SMALL');
      timestamp.textContent = new Date(benchmark.created).toLocaleString();
      benchmarkLink.appendChild(timestamp);

      benchmarksList.appendChild(benchmarkLink);
    });
  }

  function highlightBenchmark(title) {
    var benchmarkLink = Lazy(benchmarksList.children).find(function(link) {
      return link.querySelector('.title').textContent === title;
    });

    if (!benchmarkLink) {
      return;
    }

    benchmarkLink.className = 'highlighted';
    setTimeout(function() {
      benchmarkLink.removeAttribute('class');
    }, 1000);
  }

  function addResultsRow(benchmark) {
    var resultRow = document.createElement('TR'),
        labelCell = document.createElement('TD'),
        benchCell = document.createElement('TD');

    labelCell.textContent = benchmark.name;
    benchCell.textContent = formatNumber(benchmark.hz);
    resultRow.appendChild(labelCell);
    resultRow.appendChild(benchCell);

    results.appendChild(resultRow);

    return resultRow;
  }

  function runBenchmarks() {
    var suite  = new Benchmark.Suite();

    results.innerHTML = '';
    progress.innerHTML = '';
    chart.innerHTML = '';

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

      addResultsRow(benchmark);

      if (results.children.length === 3) {
        createChartFromTable();
        runButton.removeAttribute('disabled');
      }
    });

    runButton.setAttribute('disabled', 'disabled');
    suite.run({ async: true });
  }

  function createChartFromTable() {
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
          data: [getLastCellValue(results.children[0])]
        },
        {
          name: 'Lo-Dash',
          data: [getLastCellValue(results.children[1])]
        },
        {
          name: 'Lazy.js',
          data: [getLastCellValue(results.children[2])]
        }
      ],
      plotOptions: {
        series: {
          animation: false
        }
      },
      credits: {
        enabled: false
      }
    });
  }

  benchmarksList.addEventListener('click', function(e) {
    var benchmarkLink = e.target;

    if (benchmarkLink.nodeName === 'SPAN' && benchmarkLink.className === 'delete') {
      if (confirm('Are you sure you want to delete this benchmark?')) {
        deleteBenchmark(benchmarkLink.getAttribute('data-benchmark'));
        return;
      }
    }

    while (benchmarkLink.nodeName !== 'A') {
      benchmarkLink = benchmarkLink.parentNode;

      // Sanity check, just in case
      if (benchmarkLink === document) {
        return;
      }
    }

    var benchmarkIndex = benchmarkLink.getAttribute('data-benchmark');
    var benchmark = loadSavedBenchmarks()[benchmarkIndex];

    title.value = benchmark.title;
    setupEditor.setValue(benchmark.setup);
    lazyEditor.setValue(benchmark.lazy);
    underscoreEditor.setValue(benchmark.underscore);

    results.innerHTML = '';
    progress.innerHTML = '';
    chart.innerHTML = '';

    if (benchmark.lazyResult) {
      addResultsRow({ name: 'Underscore', hz: benchmark.underscoreResult });
      addResultsRow({ name: 'Lo-Dash', hz: benchmark.lodashResult });
      addResultsRow({ name: 'Lazy.js', hz: benchmark.lazyResult });

      createChartFromTable();
    }
  });

  newButton.addEventListener('click', function() {
    results.innerHTML = '';
    progress.innerHTML = '';
    chart.innerHTML = '';
    title.value = '';
    setupEditor.setValue('');
    lazyEditor.setValue('');
    underscoreEditor.setValue('');
  });

  runButton.addEventListener('click', function() {
    runBenchmarks();
  });

  saveButton.addEventListener('click', function() {
    var data = {
      title: title.value,
      setup: setupEditor.getValue(),
      lazy: lazyEditor.getValue(),
      underscore: underscoreEditor.getValue(),
      underscoreResult: getLastCellValue(results.children[0]),
      lodashResult: getLastCellValue(results.children[1]),
      lazyResult: getLastCellValue(results.children[2]),
      created: new Date().getTime()
    };

    var benchmarks = loadSavedBenchmarks();

    var existingIndex = Lazy(benchmarks).pluck('title').indexOf(data.title);

    if (existingIndex !== -1) {
      benchmarks[existingIndex] = Lazy(benchmarks[existingIndex])
        .extend(data)
        .toObject();

    } else {
      benchmarks.push(data);
    }

    saveBenchmarks(benchmarks, data.title);
  });

  populateBenchmarksList(loadSavedBenchmarks());
});

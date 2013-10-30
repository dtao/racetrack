var lodash = _.noConflict();

function getChartOptions() {
  var title = document.querySelector('input[name="title"]').value;

  return {
    title: {
      text: title
    },
    plotOptions: {
      series: {
        animation: false
      }
    }
  };
}

window.addEventListener('load', function() {
  Benchmark.options.maxTime = 1.0;

  var results  = document.querySelector('table#results tbody'),
      progress = document.getElementById('progress'),
      chart    = document.getElementById('chart'),
      errors   = document.getElementById('errors');

  function createEditor(containerId) {
    var container = document.getElementById(containerId),
        textarea  = container.querySelector('textarea');

    return CodeMirror.fromTextArea(textarea, {
      mode: 'javascript',
      lineNumbers: true
    });
  }

  var title             = document.querySelector('input[name="title"]'),
      inputSizes        = document.querySelector('input[name="input-sizes"]'),
      benchmarksList    = document.querySelector('.saved-benchmarks'),
      setupEditor       = createEditor('setup'),
      lazyEditor        = createEditor('lazy'),
      underscoreEditor  = createEditor('underscore'),
      newButton         = document.getElementById('new-benchmark'),
      runButton         = document.getElementById('run-benchmarks'),
      saveButton        = document.getElementById('save-benchmarks'),
      benchmarkTemplate = document.getElementById('benchmark-template').textContent;

  function displayError(message) {
    var error = document.createElement('P');
    error.textContent = message;
    errors.appendChild(error);
  }

  function addBenchmarkToSuite(name, editor, inputSize, transformer) {
    transformer = transformer || function(code) { return code; };

    var js = _.template(benchmarkTemplate, {
      name: name,
      setup: setupEditor.getValue(),
      code: transformer(editor.getValue()),
      inputSize: inputSize
    });

    return js;
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

  function getRowData(row) {
    if (!row) {
      return null;
    }

    return {
      name: row.children[0].textContent,
      results: Lazy(row.querySelectorAll('td:not(:first-child)')).map(function(cell) {
        return {
          inputSize: cell.getAttribute('data-input-size'),
          hz: parseNumber(cell.textContent)
        };
      }).toArray()
    };
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
    benchmarkLink.scrollIntoView();

    setTimeout(function() {
      benchmarkLink.removeAttribute('class');
    }, 1000);
  }

  function resetResultsTable() {
    var headerRow = results
      .parentNode         // TABLE
      .firstElementChild  // THEAD
      .firstElementChild; // TR

    // Remove all but the first TH element
    for (var i = headerRow.children.length - 1; i >= 1; --i) {
      headerRow.removeChild(headerRow.children[i]);
    }
  }

  function addInputSizeColumn(inputSize) {
    // Yeah, I know, DRY violation...
    var headerRow = results
      .parentNode         // TABLE
      .firstElementChild  // THEAD
      .firstElementChild; // TR

    var columnHeader = document.createElement('TH');
    columnHeader.textContent = 'Ops/sec (N=' + inputSize + ')';
    headerRow.appendChild(columnHeader);
  }

  function addResultsRow(data) {
    var resultRow = document.createElement('TR');
    resultRow.setAttribute('data-benchmark', data.name);
    results.appendChild(resultRow);

    var labelCell = document.createElement('TD');
    labelCell.textContent = data.name;
    resultRow.appendChild(labelCell);

    Lazy(data.results).each(function(result) {
      var cell = document.createElement('TD');
      cell.setAttribute('data-input-size', result.inputSize);
      cell.textContent = formatNumber(result.hz);

      resultRow.appendChild(cell);
    });

    return resultRow;
  }

  function addOrUpdateResultsRow(benchmark, sizes) {
    var resultRow = results.querySelector('tr[data-benchmark="' + benchmark.name + '"]');

    if (!resultRow) {
      resultRow = document.createElement('TR');
      resultRow.setAttribute('data-benchmark', benchmark.name);

      var labelCell = document.createElement('TD');
      labelCell.textContent = benchmark.name;
      resultRow.appendChild(labelCell);

      Lazy(sizes).each(function(size) {
        var sizeCell = document.createElement('TD');
        sizeCell.setAttribute('data-input-size', size);
        resultRow.appendChild(sizeCell);
      });

      results.appendChild(resultRow);
    }

    var resultCell = resultRow.querySelector('td[data-input-size="' + benchmark.inputSize + '"]');
    resultCell.textContent = formatNumber(benchmark.hz);

    return resultRow;
  }

  function runBenchmarks() {
    var suite  = new Benchmark.Suite();

    results.innerHTML = '';
    progress.innerHTML = '';
    chart.innerHTML = '';

    resetResultsTable();

    var sizes = inputSizes.value.split(/,\s*/);

    Lazy(sizes).each(function(inputSize) {
      addInputSizeColumn(inputSize);

      eval(addBenchmarkToSuite('Underscore', underscoreEditor, inputSize));
      eval(addBenchmarkToSuite('Lo-Dash', underscoreEditor, inputSize, function(code) {
        return code.replace(/\b_\b/g, 'lodash');
      }));
      eval(addBenchmarkToSuite('Lazy.js', lazyEditor, inputSize));
    });

    var cycles      = {},
        topCycles   = 0,
        resultCount = 0;

    suite.forEach(function(benchmark) {
      benchmark.on('cycle', function() {
        var label = benchmark.name + ' (N=' + benchmark.inputSize + ')';

        var progressBar = progress.querySelector('.progress-bar[data-benchmark="' + label + '"]');

        if (!progressBar) {
          progressBar = document.createElement('DIV');
          progressBar.className = 'progress progress-striped active';
          progress.appendChild(progressBar);

          progressBar = progressBar.appendChild(document.createElement('DIV'));
          progressBar.className = 'progress-bar';
          progressBar.setAttribute('data-benchmark', label);

          progressBar.appendChild(document.createElement('SPAN'));
        }

        var currentCycles = cycles[label] || 0;
        currentCycles += benchmark.count;
        topCycles = Math.max(topCycles, currentCycles);

        progressBar.querySelector('SPAN').textContent =
          label + ': ' + currentCycles + ' runs';

        cycles[label] = currentCycles;

        Lazy(progress.querySelectorAll('.progress-bar')).each(function(bar) {
          var benchmarkCycles = cycles[bar.getAttribute('data-benchmark')];
          bar.style.width = Math.floor(benchmarkCycles / topCycles * 100) + '%';
        });
      });

      benchmark.on('error', function(e) {
        displayError(e.message);
      });
    });

    suite.on('cycle', function(e) {
      var benchmark = e.target;

      var currentProgressBar = progress.querySelector('.progress.active');
      if (currentProgressBar) {
        currentProgressBar.className = 'progress';
      }

      addOrUpdateResultsRow(benchmark, sizes);

      if (++(resultCount) === (3 * sizes.length)) {
        createChartFromTable();
        runButton.removeAttribute('disabled');
      }
    });

    runButton.setAttribute('disabled', 'disabled');
    suite.run({ async: true });
  }

  function createChartFromTable() {
    chart.style.display = null;

    HighTables.renderCharts();

    setTimeout(function() { progress.innerHTML = ''; }, 1000);
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
    inputSizes.value = benchmark.inputSizes || '';
    setupEditor.setValue(benchmark.setup);
    lazyEditor.setValue(benchmark.lazy);
    underscoreEditor.setValue(benchmark.underscore);

    results.innerHTML = '';
    progress.innerHTML = '';
    chart.innerHTML = '';

    resetResultsTable();

    if (benchmark.lazyResults) {
      Lazy(benchmark.lazyResults.results).pluck('inputSize').each(addInputSizeColumn);

      addResultsRow(benchmark.underscoreResults);
      addResultsRow(benchmark.lodashResults);
      addResultsRow(benchmark.lazyResults);

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
      inputSizes: inputSizes.value,
      setup: setupEditor.getValue(),
      lazy: lazyEditor.getValue(),
      underscore: underscoreEditor.getValue(),
      underscoreResults: getRowData(results.children[0]),
      lodashResults: getRowData(results.children[1]),
      lazyResults: getRowData(results.children[2]),
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

  window.addEventListener('error', function(e) {
    displayError(e.message);
  });

  populateBenchmarksList(loadSavedBenchmarks());
});

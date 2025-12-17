
(function () {
  var mq = window.matchMedia('(max-width: 768px)');

  function enhanceBondPayments() {
    var rows = document.querySelectorAll('.bond-payments tbody tr');
    if (!rows.length) return;

    rows.forEach(function (tr) {
      var cells = tr.querySelectorAll('td');
      if (cells.length < 6) return;

      // [0] №, [1] Вид, [2] Дата, [3] Сумма, [4] %, [5] Остаток
      var typeCell = cells[1];
      var dateCell = cells[2];

      if (mq.matches) {
        if (!dateCell.querySelector('.bp__type')) {
          var typeText = (typeCell.textContent || '').trim();
          if (typeText) {
            var extra = document.createElement('div');
            extra.className = 'bp__type';
            extra.textContent = typeText;
            dateCell.appendChild(extra);
          }
        }
      } else {
        var addon = dateCell.querySelector('.bp__type');
        if (addon) addon.remove();
      }
    });
  }

  enhanceBondPayments();
  window.addEventListener('resize', enhanceBondPayments);
})();

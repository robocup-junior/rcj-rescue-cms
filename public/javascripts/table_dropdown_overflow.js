// .base-table/.modern-card use overflow:hidden to keep their rounded corners,
// which clips a .table-action-dropdown menu when Bootstrap flips it upward
// near the bottom of the table. While a dropdown is open we lift that clip on
// its nearest .base-table/.modern-card ancestors via the .dropdown-open class
// (see modern_list.css), then restore it once the dropdown closes.
(function () {
  function toggleAncestors(dropdown, add) {
    var node = dropdown.parentElement;
    while (node) {
      if (node.classList.contains('base-table') || node.classList.contains('modern-card')) {
        node.classList.toggle('dropdown-open', add);
      }
      node = node.parentElement;
    }
  }

  $(document).on('show.bs.dropdown', '.table-action-dropdown', function () {
    toggleAncestors(this, true);
  });

  $(document).on('hidden.bs.dropdown', '.table-action-dropdown', function () {
    toggleAncestors(this, false);
  });
})();

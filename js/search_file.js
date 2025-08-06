document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');

    window.searchFiles = function () {
        const query = searchInput.value.trim().toLowerCase();
        const filtered = (window.allFiles || []).filter(file => {
            const name = (file.name || "").toLowerCase();
            const description = (file.description || "").toLowerCase();
            return name.includes(query) || description.includes(query);
        });
        if (window.renderTable) {
            window.renderTable(filtered);
        }
    }

    // Live search as you type
    searchInput.addEventListener('input', window.searchFiles);
});

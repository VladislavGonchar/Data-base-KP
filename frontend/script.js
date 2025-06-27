const API_URL = "http://localhost:8000";

// Отримуємо всі необхідні елементи DOM
const modal = document.getElementById("gpu-modal");
const addBtn = document.getElementById("add-gpu-btn");
const closeBtn = document.querySelector(".close-btn");
const gpuForm = document.getElementById("gpu-form");
const gpuTableBody = document.getElementById("gpu-table-body");
const manufacturerSelect = document.getElementById("manufacturer-id");
const memoryTypeSelect = document.getElementById("memory-type");
const modalTitle = document.getElementById("modal-title");
const submitBtn = document.getElementById("submit-btn");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const resetSearchBtn = document.getElementById("reset-search-btn");
const sortSelect = document.getElementById("sort-select");
const filterManufacturer = document.getElementById("filter-manufacturer");
const filterMemoryType = document.getElementById("filter-memory-type");

// Стан додатку
let currentAction = "add";
let currentGpuId = null;
let currentSpecId = null;
let currentPriceId = null;
let allGPUs = [];
let allManufacturers = [];
let allMemoryTypes = [
    "GDDR6", "GDDR6X", "GDDR5", "GDDR5X",
    "HBM2", "HBM2E", "HBM3", "LPDDR4", "LPDDR5"
];

// Ініціалізація додатку
document.addEventListener("DOMContentLoaded", () => {
    initMemoryTypes();
    loadManufacturers();
    loadGPUs();
    
    // Додаємо обробники подій
    addBtn.addEventListener("click", showAddModal);
    closeBtn.addEventListener("click", hideModal);
    window.addEventListener("click", clickOutsideModal);
    gpuForm.addEventListener("submit", handleFormSubmit);
    searchBtn.addEventListener("click", searchGPUs);
    resetSearchBtn.addEventListener("click", resetSearch);
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === 'Enter') searchGPUs();
    });
    sortSelect.addEventListener("change", applySortingAndFilters);
    filterManufacturer.addEventListener("change", applySortingAndFilters);
    filterMemoryType.addEventListener("change", applySortingAndFilters);
});

// Ініціалізація списку типів пам'яті
function initMemoryTypes() {
    memoryTypeSelect.innerHTML = '<option value="">Оберіть тип пам\'яті</option>';
    filterMemoryType.innerHTML = '<option value="">Всі типи пам\'яті</option>';
    
    allMemoryTypes.forEach(type => {
        // Для форми додавання/редагування
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        memoryTypeSelect.appendChild(option);
        
        // Для фільтра
        const filterOption = document.createElement("option");
        filterOption.value = type;
        filterOption.textContent = type;
        filterMemoryType.appendChild(filterOption);
    });
}

// Завантаження виробників
async function loadManufacturers() {
    try {
        const response = await fetch(`${API_URL}/manufacturers/`);
        if (!response.ok) throw new Error("Помилка завантаження виробників");
        
        allManufacturers = await response.json();
        
        // Для форми додавання/редагування
        manufacturerSelect.innerHTML = '<option value="">Оберіть виробника</option>';
        
        // Для фільтра
        filterManufacturer.innerHTML = '<option value="">Всі виробники</option>';
        
        allManufacturers.forEach(manufacturer => {
            // Для форми
            const option = document.createElement("option");
            option.value = manufacturer.id;
            option.textContent = manufacturer.name;
            manufacturerSelect.appendChild(option);
            
            // Для фільтра
            const filterOption = document.createElement("option");
            filterOption.value = manufacturer.id;
            filterOption.textContent = manufacturer.name;
            filterManufacturer.appendChild(filterOption);
        });
    } catch (error) {
        console.error("Помилка завантаження виробників:", error);
        alert("Не вдалося завантажити виробників");
    }
}

// Завантаження відеокарт
async function loadGPUs() {
    try {
        const response = await fetch(`${API_URL}/gpus/`);
        if (!response.ok) throw new Error("Помилка завантаження відеокарт");
        
        allGPUs = await response.json();
        applySortingAndFilters();
    } catch (error) {
        console.error("Помилка завантаження відеокарт:", error);
        showError("Помилка завантаження даних");
    }
}

// Відображення GPU з урахуванням фільтрів та сортування
function applySortingAndFilters() {
    let filteredGPUs = [...allGPUs];
    
    // Застосовуємо пошук
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        filteredGPUs = filteredGPUs.filter(gpu => {
            const manufacturer = gpu.manufacturer?.name?.toLowerCase() || "";
            const model = gpu.name?.toLowerCase() || "";
            return manufacturer.includes(searchTerm) || model.includes(searchTerm);
        });
    }
    
    // Застосовуємо фільтри
    const manufacturerFilter = filterManufacturer.value;
    if (manufacturerFilter) {
        filteredGPUs = filteredGPUs.filter(gpu => 
            gpu.manufacturer?.id?.toString() === manufacturerFilter
        );
    }
    
    const memoryTypeFilter = filterMemoryType.value;
    if (memoryTypeFilter) {
        filteredGPUs = filteredGPUs.filter(gpu => 
            gpu.specifications?.[0]?.memory_type === memoryTypeFilter
        );
    }
    
    // Застосовуємо сортування
    const sortValue = sortSelect.value;
    if (sortValue) {
        const [field, direction] = sortValue.split("_");
        
        filteredGPUs.sort((a, b) => {
            let valueA, valueB;
            
            switch (field) {
                case "price":
                    valueA = a.prices?.[0]?.price || 0;
                    valueB = b.prices?.[0]?.price || 0;
                    break;
                case "power":
                    valueA = a.specifications?.[0]?.psu_power_requirement || 0;
                    valueB = b.specifications?.[0]?.psu_power_requirement || 0;
                    break;
                case "resolution":
                    valueA = a.specifications?.[0]?.max_resolution || "";
                    valueB = b.specifications?.[0]?.max_resolution || "";
                    break;
                case "clock":
                    valueA = a.specifications?.[0]?.base_clock || 0;
                    valueB = b.specifications?.[0]?.base_clock || 0;
                    break;
                case "bus":
                    valueA = a.specifications?.[0]?.bus_width || 0;
                    valueB = b.specifications?.[0]?.bus_width || 0;
                    break;
                case "memory":
                    valueA = a.specifications?.[0]?.memory_size || 0;
                    valueB = b.specifications?.[0]?.memory_size || 0;
                    break;
                case "year":
                    valueA = a.release_year || 0;
                    valueB = b.release_year || 0;
                    break;
                default:
                    return 0;
            }
            
            if (typeof valueA === 'string' && typeof valueB === 'string') {
                return direction === 'asc' 
                    ? valueA.localeCompare(valueB)
                    : valueB.localeCompare(valueA);
            } else {
                return direction === 'asc' 
                    ? valueA - valueB
                    : valueB - valueA;
            }
        });
    }
    
    renderGPUs(filteredGPUs);
}

// Відображення списку GPU
function renderGPUs(gpus) {
    gpuTableBody.innerHTML = "";
    
    if (!gpus || gpus.length === 0) {
        gpuTableBody.innerHTML = `
            <tr>
                <td colspan="11" class="no-data">Немає відеокарт, що відповідають критеріям</td>
            </tr>
        `;
        return;
    }
    
    gpus.forEach(gpu => {
        const spec = gpu.specifications?.[0] || {};
        const price = gpu.prices?.[0] || {};
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${gpu.manufacturer?.name || "—"}</td>
            <td>${gpu.name || "—"}</td>
            <td>${gpu.release_year || "—"}</td>
            <td>${spec.memory_size || "—"}</td>
            <td>${spec.memory_type || "—"}</td>
            <td>${spec.bus_width || "—"}</td>
            <td>${spec.base_clock || "—"}</td>
            <td>${spec.max_resolution || "—"}</td>
            <td>${spec.psu_power_requirement || "—"}</td>
            <td>${price.price ? price.price.toFixed(2) : "—"}</td>
            <td class="action-buttons">
                <button class="edit-btn" onclick="editGPU(${gpu.id})">Редагувати</button>
                <button class="delete-btn" onclick="deleteGPU(${gpu.id})">Видалити</button>
            </td>
        `;
        gpuTableBody.appendChild(row);
    });
}

// Пошук GPU
function searchGPUs() {
    applySortingAndFilters();
}

// Скидання пошуку
function resetSearch() {
    searchInput.value = "";
    applySortingAndFilters();
}

// Показати модальне вікно для додавання
function showAddModal() {
    currentAction = "add";
    modalTitle.textContent = "Додати нову відеокарту";
    submitBtn.textContent = "Додати";
    gpuForm.reset();
    modal.style.display = "block";
}

// Приховати модальне вікно
function hideModal() {
    modal.style.display = "none";
}

// Закрити модальне вікно при кліку поза ним
function clickOutsideModal(e) {
    if (e.target === modal) {
        hideModal();
    }
}

// Обробник форми
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const gpuData = {
        name: document.getElementById("gpu-name").value,
        manufacturer_id: parseInt(document.getElementById("manufacturer-id").value),
        release_year: parseInt(document.getElementById("gpu-year").value)
    };

    const specData = {
        memory_size: parseInt(document.getElementById("memory-size").value),
        memory_type: document.getElementById("memory-type").value,
        bus_width: parseInt(document.getElementById("bus-width").value),
        base_clock: parseInt(document.getElementById("base-clock").value),
        max_resolution: document.getElementById("max-resolution").value,
        psu_power_requirement: parseInt(document.getElementById("psu-power").value)
    };

    const priceData = {
        price: parseFloat(document.getElementById("price").value),
        date: new Date().toISOString().split('T')[0]
    };

    try {
        if (currentAction === "add") {
            // Додаємо відеокарту
            const gpuResponse = await fetch(`${API_URL}/gpus/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(gpuData)
            });
            const gpu = await gpuResponse.json();

            // Додаємо специфікації
            await fetch(`${API_URL}/specifications/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...specData, gpu_id: gpu.id })
            });

            // Додаємо ціну
            await fetch(`${API_URL}/prices/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...priceData, gpu_id: gpu.id })
            });
            
            showSuccess("Відеокарта успішно додана");
        } else {
            // Оновлюємо відеокарту
            await fetch(`${API_URL}/gpus/${currentGpuId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(gpuData)
            });

            // Оновлюємо специфікації
            if (currentSpecId) {
                await fetch(`${API_URL}/specifications/${currentSpecId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...specData, gpu_id: currentGpuId })
                });
            } else {
                await fetch(`${API_URL}/specifications/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...specData, gpu_id: currentGpuId })
                });
            }

            // Оновлюємо ціну
            if (currentPriceId) {
                await fetch(`${API_URL}/prices/${currentPriceId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...priceData, gpu_id: currentGpuId })
                });
            } else {
                await fetch(`${API_URL}/prices/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...priceData, gpu_id: currentGpuId })
                });
            }
            
            showSuccess("Відеокарта успішно оновлена");
        }

        hideModal();
        loadGPUs();
    } catch (error) {
        console.error("Помилка збереження:", error);
        showError("Помилка при збереженні даних");
    }
}

// Редагування GPU
window.editGPU = async function(gpuId) {
    try {
        const response = await fetch(`${API_URL}/gpus/${gpuId}`);
        if (!response.ok) throw new Error("Помилка завантаження даних");
        
        const gpu = await response.json();
        
        currentAction = "edit";
        currentGpuId = gpuId;
        currentSpecId = gpu.specifications?.[0]?.id || null;
        currentPriceId = gpu.prices?.[0]?.id || null;
        
        modalTitle.textContent = "Редагувати відеокарту";
        submitBtn.textContent = "Оновити";
        
        // Заповнюємо основні дані
        document.getElementById("manufacturer-id").value = gpu.manufacturer.id;
        document.getElementById("gpu-name").value = gpu.name;
        document.getElementById("gpu-year").value = gpu.release_year;
        
        // Заповнюємо специфікації
        const spec = gpu.specifications?.[0] || {};
        document.getElementById("memory-size").value = spec.memory_size || "";
        
        // Встановлюємо тип пам'яті
        if (spec.memory_type) {
            const memoryType = spec.memory_type;
            const options = memoryTypeSelect.options;
            for (let i = 0; i < options.length; i++) {
                if (options[i].value === memoryType) {
                    memoryTypeSelect.selectedIndex = i;
                    break;
                }
            }
        }
        
        document.getElementById("bus-width").value = spec.bus_width || "";
        document.getElementById("base-clock").value = spec.base_clock || "";
        document.getElementById("max-resolution").value = spec.max_resolution || "";
        document.getElementById("psu-power").value = spec.psu_power_requirement || "";
        
        // Заповнюємо ціну
        document.getElementById("price").value = gpu.prices?.[0]?.price || "";
        
        modal.style.display = "block";
    } catch (error) {
        console.error("Помилка завантаження даних:", error);
        showError("Не вдалося завантажити дані для редагування");
    }
};

// Видалення GPU
window.deleteGPU = async function(gpuId) {
    if (confirm("Ви впевнені, що хочете видалити цю відеокарту?")) {
        try {
            const response = await fetch(`${API_URL}/gpus/${gpuId}`, {
                method: "DELETE"
            });
            
            if (!response.ok) throw new Error("Помилка видалення");
            
            showSuccess("Відеокарта успішно видалена");
            loadGPUs();
        } catch (error) {
            console.error("Помилка видалення:", error);
            showError("Не вдалося видалити відеокарту");
        }
    }
};

// Показати повідомлення про успіх
function showSuccess(message) {
    alert(message); // Можна замінити на гарніші сповіщення
}

// Показати повідомлення про помилку
function showError(message) {
    alert(message); // Можна замінити на гарніші сповіщення
}
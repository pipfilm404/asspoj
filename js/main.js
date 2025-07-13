// Основной модуль приложения АЖОПС
document.addEventListener('DOMContentLoaded', () => {
    console.log('АЖОПС v.1.0.0.0 запущена');
    
    // Инициализация приложения
    AppController.init();
});

// Контроллер приложения
const AppController = {
    // Состояние приложения
    state: {
        trains: [],              // Список всех поездов
        selectedTrain: null,     // Выбранный поезд
        selectedWagon: null,     // Выбранный вагон
        selectedType: null,      // Выбранный тип оборудования
        trainData: null,         // Данные о выбранном поезде
        equipmentList: [],       // Список оборудования текущего типа
        currentMarkIndex: 0,     // Индекс текущей метки
        autoMode: false,         // Активен ли автоматический режим
        autoModeTimer: null,     // Таймер автоматического режима
        autoModeInterval: 15000, // Интервал автоматического режима (15 секунд)
        isTouchDevice: false,     // Определение сенсорного устройства
        organizedEquipment: null, // Организованное оборудование
        selectedEquipmentType: null, // Выбранный тип оборудования
        isLoading: false,
        markHistory: []
    },

    // Инициализация приложения
    init: function() {
        this.detectTouchDevice();
        
        // Убедимся, что активен только один экран при старте
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const mainScreen = document.getElementById('main-screen');
        if (mainScreen) {
            mainScreen.classList.add('active');
        }
        
        this.setupEventListeners();
        this.loadTrainList();
    },

    // Определение сенсорного устройства
    detectTouchDevice: function() {
        this.state.isTouchDevice = ('ontouchstart' in window) || 
            (navigator.maxTouchPoints > 0) || 
            (navigator.msMaxTouchPoints > 0);
        
        if (this.state.isTouchDevice) {
            document.body.classList.add('touch-device');
        }
    },

    // Настройка обработчиков событий
    setupEventListeners: function() {
        this.setupMainScreenHandlers();
        this.setupEquipmentScreenHandlers();
        this.setupQRScreenHandlers();
        
        // Добавление обработки свайпов для мобильных устройств
        if (this.state.isTouchDevice) {
            this.setupSwipeGestures();
        }
    },

    // Настройка обработчиков событий на главном экране
    setupMainScreenHandlers: function() {
        const trainInput = document.getElementById('train-input');
        const trainDropdown = document.querySelector('.train-dropdown');
        const nextArrow = document.getElementById('next-arrow');

        // Обработчик клика на поле ввода
        trainInput.addEventListener('click', () => {
            if (this.state.trains.length > 0) {
                this.showTrainDropdown();
            }
        });

        // Обработчик ввода текста
        trainInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            // Изменение цвета текста в зависимости от наличия ввода
            if (query.length > 0) {
                trainInput.classList.remove('empty');
            } else {
                trainInput.classList.add('empty');
                // Скрываем стрелку при очистке поля
                this.hideNextArrow();
                this.state.selectedTrain = null;
            }
            
            this.filterTrainList(query);
        });

        // Обработчик фокуса на поле ввода
        trainInput.addEventListener('focus', () => {
            if (this.state.trains.length > 0) {
                this.showTrainDropdown();
            }
        });

        // Обработчик потери фокуса
        trainInput.addEventListener('blur', () => {
            // Задержка для обработки клика на элементе списка
            setTimeout(() => {
                this.hideTrainDropdown();
            }, 200);
        });

        // Обработчик нажатия клавиш
        trainInput.addEventListener('keydown', (e) => {
            const dropdown = document.querySelector('.train-dropdown');
            const visibleItems = Array.from(dropdown.querySelectorAll('.train-item:not(.hidden)'));
            
            if (visibleItems.length === 0) return;
            
            const highlightedItem = dropdown.querySelector('.train-item.highlighted');
            let currentIndex = highlightedItem 
                ? visibleItems.indexOf(highlightedItem) 
                : -1;
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (currentIndex < visibleItems.length - 1) {
                        currentIndex++;
                    } else {
                        currentIndex = 0;
                    }
                    this.highlightTrainItem(visibleItems[currentIndex]);
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    if (currentIndex > 0) {
                        currentIndex--;
                    } else {
                        currentIndex = visibleItems.length - 1;
                    }
                    this.highlightTrainItem(visibleItems[currentIndex]);
                    break;
                    
                case 'Enter':
                    e.preventDefault();
                    if (highlightedItem) {
                        this.selectTrain(highlightedItem.dataset.train);
                    } else if (visibleItems.length > 0) {
                        this.selectTrain(visibleItems[0].dataset.train);
                    }
                    break;
                    
                case 'Escape':
                    e.preventDefault();
                    this.hideTrainDropdown();
                    break;
            }
        });

        // Обработчик клика на стрелку далее
        nextArrow.addEventListener('click', () => {
            const trainInput = document.getElementById('train-input');
            const trainId = trainInput.value.trim();
            
            if (trainId) {
                // Проверяем, есть ли такой поезд в списке
                const train = this.state.trains.find(t => t.id === trainId);
                if (train) {
                    this.state.selectedTrain = train;
                    this.goToLoadingScreen();
                } else {
                    this.showError('Поезд не найден. Пожалуйста, выберите поезд из списка.');
                }
            } else {
                this.showError('Пожалуйста, выберите поезд');
            }
        });

        // Обработчик нажатия клавиши Enter на стрелке
        nextArrow.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                nextArrow.click();
            }
        });
    },

    // Настройка обработчиков событий на экране выбора оборудования
    setupEquipmentScreenHandlers: function() {
        // Кнопка возврата на главный экран
        const backButton = document.getElementById('back-to-main');
        backButton.addEventListener('click', () => {
            this.goToMainScreen();
        });

        // Кнопки выбора типа оборудования
        document.querySelectorAll('.equipment-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                this.selectEquipmentType(type);
            });
        });
    },

    // Установка обработчиков событий для экрана QR-кода
    setupQRScreenHandlers: function() {
        console.log('Настройка обработчиков для экрана QR-кода');
        
        // Кнопка возврата к экрану выбора оборудования
        const backButton = document.getElementById('back-to-equipment');
        if (backButton) {
            backButton.addEventListener('click', () => {
                console.log('Нажата кнопка возврата к экрану оборудования');
                this.goToEquipmentScreen();
            });
        }
        
        // Поле ввода для метки
        const markInput = document.getElementById('mark-input');
        if (markInput) {
            // Обработка фокуса на поле ввода
            markInput.addEventListener('focus', () => {
                console.log('Получен фокус на поле ввода метки');
                
                // Заполняем выпадающий список метками
                this.populateMarkDropdown();
                
                // Показываем выпадающий список
                this.showMarkDropdown();
            });
            
            // Обработка потери фокуса
            markInput.addEventListener('blur', (e) => {
                console.log('Потеря фокуса на поле ввода метки');
                // Задержка для возможности клика по выпадающему списку
                setTimeout(() => {
                    this.hideMarkDropdown();
                }, 200);
            });
            
            // Обработка ввода текста
            markInput.addEventListener('input', (e) => {
                const query = e.target.value;
                console.log(`Ввод текста в поле метки: "${query}"`);
                
                // Изменение класса в зависимости от наличия текста
                if (query.trim().length > 0) {
                    markInput.classList.remove('empty');
                } else {
                    markInput.classList.add('empty');
                }
                
                this.filterMarkDropdown(query);
            });
            
            // Обработка нажатия клавиш
            markInput.addEventListener('keydown', (e) => {
                this.handleMarkInputKeydown(e);
                
                // При нажатии Enter генерируем QR-код
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.generateQRCode();
                }
            });
            
            // Начальное состояние поля ввода
            if (markInput.value.trim() === '') {
                markInput.classList.add('empty');
            } else {
                markInput.classList.remove('empty');
            }
        }
        
        // Выпадающий список меток
        const markDropdown = document.getElementById('mark-dropdown');
        if (markDropdown) {
            // Предотвращаем закрытие при клике внутри списка
            markDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            // Предотвращаем скрытие при скролле внутри списка
            markDropdown.addEventListener('scroll', (e) => {
                e.stopPropagation();
            });
        }
        
        // Кнопки навигации по меткам (если есть)
        const prevMarkButton = document.getElementById('prev-mark');
        if (prevMarkButton) {
            prevMarkButton.addEventListener('click', () => {
                console.log('Нажата кнопка предыдущей метки');
                this.showPreviousMark();
            });
        }
        
        const nextMarkButton = document.getElementById('next-mark');
        if (nextMarkButton) {
            nextMarkButton.addEventListener('click', () => {
                console.log('Нажата кнопка следующей метки');
                this.showNextMark();
            });
        }
        
        // Кнопка автоматического режима (если есть)
        const autoModeButton = document.getElementById('auto-mode');
        if (autoModeButton) {
            autoModeButton.addEventListener('click', () => {
                console.log('Нажата кнопка автоматического режима');
                if (this.state.autoMode) {
                    this.stopAutoMode();
                } else {
                    this.startAutoMode();
                }
            });
        }
    },

    // Настройка жестов свайпа для мобильных устройств
    setupSwipeGestures: function() {
        let touchStartX = 0;
        let touchEndX = 0;
        
        const qrcodeScreen = document.getElementById('qrcode-screen');
        
        qrcodeScreen.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, false);
        
        qrcodeScreen.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe(touchStartX, touchEndX);
        }, false);
    },
    
    // Обработка жеста свайпа
    handleSwipe: function(startX, endX) {
        const SWIPE_THRESHOLD = 100; // минимальное расстояние свайпа
        
        if (startX - endX > SWIPE_THRESHOLD) {
            // Свайп влево - следующая метка
            this.showNextMark();
        }
        
        if (endX - startX > SWIPE_THRESHOLD) {
            // Свайп вправо - предыдущая метка
            this.showPreviousMark();
        }
    },

    // Загрузка списка поездов
    loadTrainList: function() {
        console.log('Загрузка списка поездов...');
        this.state.isLoading = true;
        
        // Симулируем загрузку
        setTimeout(() => {
            fetch('data/trains.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Ошибка загрузки списка поездов. Статус: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Данные о поездах загружены успешно:', data);
                    // Проверяем формат данных и извлекаем массив поездов
                    const trains = data.trains || data;
                    if (!Array.isArray(trains)) {
                        throw new Error('Неверный формат данных: ожидается массив поездов');
                    }
                    
                    console.log('Список поездов загружен успешно:', trains);
                    this.state.trains = trains;
                    this.updateTrainDropdown(trains);
                    this.updateTrainStats(trains);
                    this.state.isLoading = false;
                })
                .catch(error => {
                    console.error('Ошибка при загрузке списка поездов:', error);
                    this.showError('Ошибка загрузки данных. Попробуйте перезагрузить страницу.');
                    this.state.isLoading = false;
                });
        }, 300);
    },
    
    // Обновление выпадающего списка поездов
    updateTrainDropdown: function(trains) {
        const dropdown = document.querySelector('.train-dropdown');
        if (!dropdown) {
            console.error('Элемент .train-dropdown не найден');
            return;
        }
        
        dropdown.innerHTML = '';
        
        if (!Array.isArray(trains)) {
            console.error('Ошибка: trains не является массивом', trains);
            return;
        }
        
        trains.forEach(train => {
            const item = document.createElement('div');
            item.className = 'train-item';
            item.dataset.train = train.id;
            item.textContent = train.id;
            
            item.addEventListener('click', () => {
                this.selectTrain(train.id);
            });
            
            dropdown.appendChild(item);
        });
    },
    
    // Обновление статистики по поездам
    updateTrainStats: function(trains) {
        const statsContainer = document.getElementById('stats-content');
        if (!statsContainer) {
            console.error('Элемент stats-content не найден');
            return;
        }
        
        // Подсчет статистики по типам поездов
        const trainCounts = this.countTrainsByType(trains);
        
        // Формирование строки статистики
        let statsText = '';
        for (const [type, count] of Object.entries(trainCounts)) {
            statsText += `${type} - ${count}`;
            if (Object.keys(trainCounts).length > 1) {
                statsText += ' | ';
            }
        }
        
        // Убираем лишний разделитель в конце
        statsText = statsText.replace(/ \| $/, '');
        
        // Обновляем содержимое
        statsContainer.textContent = statsText;
    },

    // Фильтрация списка поездов
    filterTrainList: function(query) {
        const items = document.querySelectorAll('.train-item');
        let hasVisibleItems = false;
        
        items.forEach(item => {
            const trainId = item.dataset.train.toLowerCase();
            const isVisible = trainId.includes(query.toLowerCase());
            
            item.classList.toggle('hidden', !isVisible);
            item.classList.remove('highlighted');
            
            if (isVisible) {
                hasVisibleItems = true;
            }
        });
        
        // Если есть видимые элементы, выделяем первый
        if (hasVisibleItems) {
            const firstVisible = document.querySelector('.train-item:not(.hidden)');
            this.highlightTrainItem(firstVisible);
            this.showTrainDropdown();
        } else {
            this.hideTrainDropdown();
        }
    },

    // Выделение элемента в выпадающем списке
    highlightTrainItem: function(item) {
        console.log('Выделение пункта меток:', item ? item.textContent : 'не указан');
        
        if (!item) {
            console.warn('Элемент для выделения не передан');
            return;
        }
        
        const markDropdown = document.querySelector('#mark-dropdown');
        
        if (!markDropdown) {
            console.error('Элемент #mark-dropdown не найден');
            return;
        }
        
        // Снимаем выделение со всех элементов
        markDropdown.querySelectorAll('.dropdown-item').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Выделяем текущий элемент
        item.classList.add('selected');
        
        // Прокручиваем к выделенному элементу, если он не виден
        if (!this.isElementVisible(item, markDropdown)) {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        console.log('Выделен элемент метки:', item.textContent, 'с id:', item.getAttribute('data-id'));
    },

    isElementVisible: function(element, container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        return (
            elementRect.top >= containerRect.top &&
            elementRect.bottom <= containerRect.bottom
        );
    },

    // Показать выпадающий список поездов
    showTrainDropdown: function() {
        const dropdown = document.querySelector('.train-dropdown');
        dropdown.classList.add('visible');
    },

    // Скрыть выпадающий список поездов
    hideTrainDropdown: function() {
        const dropdown = document.querySelector('.train-dropdown');
        dropdown.classList.remove('visible');
    },

    // Показать стрелку далее
    showNextArrow: function() {
        const arrow = document.getElementById('next-arrow');
        if (arrow) {
            arrow.classList.add('visible');
        }
    },

    // Скрыть стрелку далее
    hideNextArrow: function() {
        const arrow = document.getElementById('next-arrow');
        if (arrow) {
            arrow.classList.remove('visible');
        }
    },

    // Выбор поезда из списка
    selectTrain: function(trainId) {
        const train = this.state.trains.find(t => t.id === trainId);
        if (train) {
            this.state.selectedTrain = train;
            
            // Если отсутствует dataFile, создаем имя файла из ID поезда
            if (!train.dataFile) {
                train.dataFile = `${train.id}.json`;
                console.log(`Установлен путь к файлу данных поезда: ${train.dataFile}`);
            }
            
            const trainInput = document.getElementById('train-input');
            trainInput.value = train.id;
            trainInput.classList.remove('empty');
            
            // Показываем стрелку далее
            this.showNextArrow();
            
            this.hideTrainDropdown();
        }
    },

    // Переход на экран загрузки
    goToLoadingScreen: function() {
        if (!this.state.selectedTrain) {
            console.error('Не выбран поезд!');
            return;
        }
        
        console.log(`Переход на экран загрузки для поезда: ${this.state.selectedTrain.id}`);
        
        // Показываем экран загрузки
        this.switchScreen('loading-screen');
        
        // Загружаем данные о поезде
        this.loadSelectedTrainData()
            .then(data => {
                // Сохраняем данные в состоянии
                this.state.trainData = data;
                
                // Организуем оборудование по типам
                this.state.organizedEquipment = this.organizeEquipmentByType(data);
                
                // Для отладки - выводим организованное оборудование
                console.log('Организованное оборудование:', this.state.organizedEquipment);
                
                // Переходим к экрану выбора оборудования
                setTimeout(() => {
                    this.goToEquipmentScreen();
                }, 1000);
            })
            .catch(error => {
                console.error('Ошибка при загрузке данных о поезде:', error);
                // Показываем сообщение об ошибке
                const errorMessage = document.getElementById('loading-error');
                if (errorMessage) {
                    errorMessage.textContent = 'Ошибка загрузки данных о поезде. Попробуйте выбрать другой состав.';
                    errorMessage.style.display = 'block';
                }
                
                // Возвращаемся к экрану выбора поезда
                setTimeout(() => {
                    this.goToMainScreen();
                }, 3000);
            });
    },

    // Переход к экрану выбора оборудования
    goToEquipmentScreen: function() {
        // Показываем экран оборудования
        this.switchScreen('equipment-screen');
        
        // Обновляем имя поезда
        const trainNameElement = document.querySelector('#equipment-screen .train-name');
        if (trainNameElement && this.state.selectedTrain) {
            trainNameElement.textContent = this.state.selectedTrain.id;
        }
        
        // Подсчитываем общее количество меток
        let totalMarks = 0;
        if (this.state.organizedEquipment) {
            Object.values(this.state.organizedEquipment).forEach(equipment => {
                equipment.forEach(item => {
                    if (item.marks && Array.isArray(item.marks)) {
                        totalMarks += item.marks.length;
                    }
                });
            });
        }
        
        // Обновляем счетчик меток
        const marksCountElement = document.getElementById('marks-count');
        if (marksCountElement) {
            marksCountElement.textContent = totalMarks.toString();
            marksCountElement.className = ''; // Удаляем все классы
        }
        
        // Очищаем текущий выбор типа оборудования
        this.state.selectedEquipmentType = null;
    },

    // Выбор типа оборудования
    selectEquipmentType: function(type) {
        console.log(`Выбран тип оборудования: ${type}`);
        
        // Визуальная активация кнопки
        document.querySelectorAll('.equipment-btn').forEach(btn => {
            if (btn.dataset.type === type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        this.state.selectedEquipmentType = type;
        
        // Проверяем наличие оборудования выбранного типа
        if (!this.state.organizedEquipment || !this.state.organizedEquipment[type] || this.state.organizedEquipment[type].length === 0) {
            this.showError(`Нет оборудования типа "${type}"`);
            return;
        }
        
        // Собираем все метки из оборудования выбранного типа
        const equipment = this.state.organizedEquipment[type];
        const allMarks = [];
        
        equipment.forEach(item => {
            if (item.marks && Array.isArray(item.marks)) {
                item.marks.forEach(mark => {
                    // Добавляем данные о вагоне к метке, если их нет
                    const enhancedMark = {
                        ...mark,
                        wagonId: mark.wagonId || item.wagonId || '',
                        name: mark.name || item.name || '',
                    };
                    allMarks.push(enhancedMark);
                });
            }
        });
        
        if (allMarks.length === 0) {
            this.showError(`Нет меток для оборудования типа "${type}"`);
            return;
        }
        
        console.log(`Найдено ${allMarks.length} меток для типа "${type}"`);
        
        // Сохраняем список меток в состоянии
        this.state.equipmentList = allMarks;
        
        // Сохраняем выбранный вагон (для совместимости)
        this.state.selectedWagon = equipment[0];
        
        // Сразу переходим к экрану QR-кода
        this.goToQRScreen();
    },
    
    // Создание элемента оборудования для списка
    createEquipmentElement: function(equipment) {
        const equipmentElement = document.createElement('div');
        equipmentElement.className = 'equipment-item';
        equipmentElement.dataset.id = equipment.id;
        equipmentElement.dataset.wagonId = equipment.wagonId;
        
        // Добавляем информацию о вагоне и названии элемента
        let title = '';
        if (equipment.wagonId) {
            title += `${equipment.wagonId} - `;
        }
        title += equipment.name || 'Без названия';
        
        // Добавляем заголовок элемента оборудования
        const titleElement = document.createElement('div');
        titleElement.className = 'equipment-item-title';
        titleElement.textContent = title;
        equipmentElement.appendChild(titleElement);
        
        // Добавляем информацию о метках, если они есть
        if (equipment.marks && equipment.marks.length > 0) {
            const subtitleElement = document.createElement('div');
            subtitleElement.className = 'equipment-item-subtitle';
            subtitleElement.textContent = `Доступно меток: ${equipment.marks.length}`;
            equipmentElement.appendChild(subtitleElement);
        }
        
        // Добавляем обработчик клика
        equipmentElement.addEventListener('click', () => {
            this.handleEquipmentClick(equipment);
        });
        
        return equipmentElement;
    },

    // Загрузка данных выбранного поезда
    loadSelectedTrainData: function() {
        if (!this.state.selectedTrain) {
            console.error('Не выбран поезд для загрузки данных');
            this.showError('Сначала выберите поезд');
            return Promise.reject('Не выбран поезд');
        }
        
        console.log(`Загрузка данных для поезда: ${this.state.selectedTrain.id}`);
        const dataUrl = this.state.selectedTrain.dataFile;
        
        // Обработка корректного пути к файлу данных
        const filePath = `data/trains/${dataUrl}`;
        
        // Обновляем имя поезда на экране загрузки
        const loadingTrainName = document.getElementById('loading-train-name');
        if (loadingTrainName) {
            loadingTrainName.textContent = this.state.selectedTrain.id;
        }
        
        // Скрываем сообщение об ошибке, если оно было показано
        const errorMessage = document.getElementById('loading-error');
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }
        
        return fetch(filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Ошибка загрузки данных поезда: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Данные поезда загружены успешно:', data);
                this.state.trainData = data;
                
                // Организовываем оборудование по типам
                this.state.organizedEquipment = this.organizeEquipmentByType(data);
                console.log('Организованное оборудование:', this.state.organizedEquipment);
                
                return data;
            })
            .catch(error => {
                console.error('Ошибка при загрузке данных поезда:', error);
                
                // Показываем ошибку на экране загрузки
                const errorMessage = document.getElementById('loading-error');
                if (errorMessage) {
                    errorMessage.textContent = 'Ошибка загрузки данных. Попробуйте выбрать другой поезд или перезагрузить страницу.';
                    errorMessage.style.display = 'block';
                }
                
                // Не переходим на экран оборудования
                return Promise.reject(error);
            });
    },

    // Подсчет количества поездов по типам
    countTrainsByType: function(trains) {
        const countByType = {};
        
        if (!Array.isArray(trains)) {
            console.error('Ошибка: trains не является массивом', trains);
            return countByType;
        }
        
        trains.forEach(train => {
            const type = train.type || 'Неизвестный';
            countByType[type] = (countByType[type] || 0) + 1;
        });
        
        return countByType;
    },

    // Организация оборудования по типам
    organizeEquipmentByType: function(trainData) {
        console.log('Организация оборудования по типам');
        
        // Проверяем наличие данных о поезде
        if (!trainData || !trainData.wagons || !Array.isArray(trainData.wagons)) {
            console.error('Некорректная структура данных поезда:', trainData);
            return null;
        }
        
        // Создаем объект для хранения оборудования по типам
        const organizedEquipment = {
            undercar: [],
            salon: [],
            cabin: []
        };

        // Сортировка вагонов в нужной последовательности
        const sortedWagons = [...trainData.wagons].sort((a, b) => {
            // Извлекаем последние 2 цифры из ID вагона
            const getLastTwoDigits = (wagon) => {
                const matches = wagon.wagon.match(/(\d{2})$/);
                return matches ? parseInt(matches[1], 10) : 0;
            };
            
            const aDigits = getLastTwoDigits(a);
            const bDigits = getLastTwoDigits(b);
            
            // Задаем порядок: 01, 02, 03, 04, 05, 06, 08, 07, 11, 10, 09
            const order = {'01': 1, '02': 2, '03': 3, '04': 4, '05': 5, '06': 6, '08': 7, '07': 8, '11': 9, '10': 10, '09': 11};
            
            const aOrder = order[`${aDigits < 10 ? '0' : ''}${aDigits}`] || 100;
            const bOrder = order[`${bDigits < 10 ? '0' : ''}${bDigits}`] || 100;
            
            return aOrder - bOrder;
        });

        // Обрабатываем каждый вагон
        sortedWagons.forEach(wagon => {
            const wagonId = wagon.wagon;
            
            // Обрабатываем каждый тип оборудования для вагона
            if (wagon.equipment && Array.isArray(wagon.equipment)) {
                wagon.equipment.forEach(eq => {
                    // Определяем тип оборудования по имени
                    let type = 'salon'; // По умолчанию
                    
                    // Анализируем название для определения типа
                    const name = eq.name ? eq.name.toLowerCase() : '';
                    
                    if (name.includes('подвагон') || name.includes('кп') || name.includes('тэд') || 
                        name.includes('бустер') || name.includes('дроссель') || name.includes('компрессор')) {
                        type = 'undercar';
                    } else if (name.includes('кабин') || name.includes('пульт') || name.includes('ручка') || 
                              name.includes('индикатор') || name.includes('бдительность')) {
                        type = 'cabin';
                    }
                    
                    // Создаем объект метки
                    const mark = {
                        id: `${wagonId}-${eq.name || 'метка'}`,
                        wagonId: wagonId,
                        name: eq.name || '',
                        label: eq.label || ''
                    };
                    
                    // Создаем объект оборудования с привязкой к вагону
                    const equipmentWithWagon = {
                        ...eq,
                        wagonId: wagonId,
                        id: `${wagonId}-${eq.name || 'оборудование'}`,
                        marks: [mark] // Добавляем метку в массив меток оборудования
                    };
                    
                    // Добавляем оборудование в соответствующую категорию
                    organizedEquipment[type].push(equipmentWithWagon);
                });
            }
        });
        
        console.log('Организованное оборудование:', organizedEquipment);
        
        return organizedEquipment;
    },
    
    // Нормализация типа оборудования для согласованности
    normalizeEquipmentType: function(type) {
        if (!type) return 'other';
        
        const typeStr = String(type).toLowerCase();
        
        if (typeStr.includes('подвагон') || typeStr.includes('колес') || typeStr.includes('brake') || typeStr.includes('wheel')) {
            return 'undercar';
        } else if (typeStr.includes('салон') || typeStr.includes('salon') || typeStr.includes('интерьер') || typeStr.includes('interior')) {
            return 'salon';
        } else if (typeStr.includes('кабин') || typeStr.includes('cabin') || typeStr.includes('driver')) {
            return 'cabin';
        }
        
        return 'other';
    },

    // Переход на главный экран
    goToMainScreen: function() {
        this.switchScreen('main-screen');
        
        // Сбрасываем состояние выбранного поезда и скрываем стрелку
        this.state.selectedTrain = null;
        this.hideNextArrow();
        
        // Очищаем поле ввода
        const trainInput = document.getElementById('train-input');
        if (trainInput) {
            trainInput.value = '';
            trainInput.classList.add('empty');
        }
    },

    // Переключение между экранами
    switchScreen: function(screenId) {
        // Проверяем, существует ли целевой экран
        const targetScreen = document.getElementById(screenId);
        if (!targetScreen) {
            console.error(`Ошибка: экран с ID "${screenId}" не найден`);
            return;
        }
        
        // Остановка автоматического режима при переключении с экрана QR-кода
        if (this.state.autoMode && screenId !== 'qrcode-screen') {
            this.stopAutoMode();
        }
        
        // Сначала скрываем все экраны
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Затем показываем нужный экран
        targetScreen.classList.add('active');
        console.log(`Переключено на экран: ${screenId}`);
    },

    // Синоним для switchScreen для совместимости
    goToScreen: function(screenId) {
        this.switchScreen(screenId);
    },

    // Отображение сообщения об ошибке
    showError: function(message) {
        console.error('Ошибка:', message);
        
        // Проверяем текущий экран
        const currentScreen = document.querySelector('.screen.active');
        if (!currentScreen) return;
        
        // Проверяем наличие контейнера для ошибок на текущем экране
        let errorContainer = currentScreen.querySelector('.error-message');
        
        // Если контейнера нет, создаем его
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.className = 'error-message';
            currentScreen.appendChild(errorContainer);
        }
        
        // Отображаем сообщение
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        
        // Автоматически скрываем сообщение через 5 секунд
        setTimeout(() => {
            errorContainer.style.display = 'none';
        }, 5000);
    },

    // Остановка автоматического режима
    stopAutoMode: function() {
        this.state.autoMode = false;
        clearInterval(this.state.autoModeTimer);
        
        // Очищаем визуальную анимацию таймера
        const autoButton = document.getElementById('auto-mode');
        if (autoButton) {
            autoButton.classList.remove('timing');
            const timer = autoButton.querySelector('.circle-timer');
            if (timer) {
                timer.remove();
            }
            
            // Обновляем текст кнопки
            const index = this.state.equipmentList && this.state.equipmentList.length > 0 
                ? ((this.state.currentMarkIndex % this.state.equipmentList.length) + this.state.equipmentList.length) % this.state.equipmentList.length 
                : 0;
            const total = this.state.equipmentList ? this.state.equipmentList.length : 0;
            autoButton.textContent = `Авто режим (${index + 1}/${total})`;
        }
    },

    // Запуск автоматического режима
    startAutoMode: function() {
        if (!this.state.equipmentList || this.state.equipmentList.length === 0) {
            this.showError('Нет доступных меток для автоматического режима');
            return;
        }
        
        this.state.autoMode = true;
        
        const autoButton = document.getElementById('auto-mode');
        if (autoButton) {
            autoButton.textContent = 'Остановить авто';
            autoButton.classList.add('timing');
        }
        
        // Запускаем таймер для автоматического переключения меток
        this.resetTimer();
        
        this.state.autoModeTimer = setInterval(() => {
            this.showNextMark();
            this.resetTimer();
        }, this.state.autoModeInterval);
    },

    // Сброс и запуск таймера визуальной обводки
    resetTimer: function() {
        const autoButton = document.getElementById('auto-mode');
        if (!autoButton) return;
        
        // Удаляем существующий таймер если есть
        const oldTimer = autoButton.querySelector('.circle-timer');
        if (oldTimer) {
            oldTimer.remove();
        }
        
        // Создаем новый элемент обводки
        const circleTimer = document.createElement('div');
        circleTimer.className = 'circle-timer';
        autoButton.appendChild(circleTimer);
        
        // Запускаем анимацию обводки
        setTimeout(() => {
            circleTimer.style.animation = `timer-animation ${this.state.autoModeInterval / 1000}s linear forwards`;
        }, 10);
    },

    // Загрузка меток для выпадающего списка
    loadMarksForDropdown: function() {
        console.log("Загрузка меток для выпадающего списка");
        const markDropdown = document.getElementById('mark-dropdown');
        const markDetails = document.getElementById('mark-details');
        
        if (!markDropdown) {
            console.error("Элемент markDropdown не найден");
            return;
        }
        
        // Очищаем список перед заполнением
        markDropdown.innerHTML = '';
        
        if (markDetails) {
            markDetails.textContent = 'Загрузка меток...';
        }
        
        // Проверяем наличие организованного оборудования
        if (!this.state.organizedEquipment || Object.keys(this.state.organizedEquipment).length === 0) {
            console.warn("Отсутствуют данные об организованном оборудовании");
            console.log("Текущее состояние приложения:", {
                selectedTrain: this.state.selectedTrain ? this.state.selectedTrain.id : 'не выбран',
                selectedEquipmentType: this.state.selectedEquipmentType || 'не выбран',
                trainData: this.state.trainData ? 'загружены' : 'не загружены',
                equipmentList: this.state.equipmentList ? this.state.equipmentList.length : 0
            });
            
            const emptyItem = document.createElement('div');
            emptyItem.classList.add('dropdown-item');
            emptyItem.textContent = 'Нет данных об оборудовании';
            markDropdown.appendChild(emptyItem);
            
            if (markDetails) {
                markDetails.textContent = 'Нет данных для отображения';
            }
            return;
        }
        
        // Проверяем выбранный тип оборудования
        if (!this.state.selectedEquipmentType) {
            console.warn("Не выбран тип оборудования");
            
            // Показываем доступные типы оборудования
            const availableTypes = Object.keys(this.state.organizedEquipment).filter(type => 
                this.state.organizedEquipment[type] && this.state.organizedEquipment[type].length > 0
            );
            
            if (availableTypes.length > 0) {
                console.log("Доступные типы оборудования:", availableTypes);
                
                // Если есть доступные типы, предложим первый из них
                this.state.selectedEquipmentType = availableTypes[0];
                console.log(`Автоматически выбран тип оборудования: ${this.state.selectedEquipmentType}`);
            } else {
                const emptyItem = document.createElement('div');
                emptyItem.classList.add('dropdown-item');
                emptyItem.textContent = 'Выберите тип оборудования';
                markDropdown.appendChild(emptyItem);
                
                if (markDetails) {
                    markDetails.textContent = 'Тип оборудования не выбран';
                }
                return;
            }
        }
        
        // Получаем оборудование выбранного типа
        const equipment = this.state.organizedEquipment[this.state.selectedEquipmentType];
        
        if (!equipment || equipment.length === 0) {
            console.warn(`Нет оборудования типа "${this.state.selectedEquipmentType}"`);
            
            // Показываем доступные типы оборудования
            const availableTypes = Object.keys(this.state.organizedEquipment).filter(type => 
                this.state.organizedEquipment[type] && this.state.organizedEquipment[type].length > 0
            );
            
            if (availableTypes.length > 0) {
                console.log("Доступные типы оборудования:", availableTypes);
                
                // Если есть другие типы с оборудованием, попробуем первый из них
                if (availableTypes.some(type => type !== this.state.selectedEquipmentType)) {
                    const alternativeType = availableTypes.find(type => type !== this.state.selectedEquipmentType);
                    console.log(`Попытка использовать альтернативный тип: ${alternativeType}`);
                    
                    this.state.selectedEquipmentType = alternativeType;
                    
                    // Рекурсивный вызов с новым типом оборудования
                    this.loadMarksForDropdown();
                    return;
                }
            }
            
            const emptyItem = document.createElement('div');
            emptyItem.classList.add('dropdown-item');
            emptyItem.textContent = `Нет оборудования типа "${this.state.selectedEquipmentType}"`;
            markDropdown.appendChild(emptyItem);
            
            if (markDetails) {
                markDetails.textContent = 'Нет данных для отображения';
            }
            return;
        }
        
        // Собираем все метки из оборудования выбранного типа
        const marks = [];
        for (const item of equipment) {
            console.log(`Проверка оборудования:`, item);
            if (item.marks && Array.isArray(item.marks)) {
                console.log(`Найдены метки (${item.marks.length}) для оборудования:`, 
                            item.name || item.id || 'Без имени');
                for (const mark of item.marks) {
                    marks.push(mark);
                }
            } else if (item.marks) {
                console.warn(`Метки для ${item.name || item.id || 'Без имени'} не являются массивом:`, item.marks);
            } else {
                console.warn(`Нет меток для оборудования:`, item.name || item.id || 'Без имени');
            }
        }
        
        console.log(`Найдено ${marks.length} меток для типа "${this.state.selectedEquipmentType}"`);
        
        if (marks.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.classList.add('dropdown-item');
            emptyItem.textContent = 'Нет доступных меток';
            markDropdown.appendChild(emptyItem);
            
            if (markDetails) {
                markDetails.textContent = 'Нет меток для отображения';
            }
            return;
        }
        
        // Для примера выводим первые 3 метки (если есть)
        const exampleMarks = marks.slice(0, 3).map(m => m.id || m.name || 'Без имени').join(', ');
        console.log(`Примеры меток: ${exampleMarks}${marks.length > 3 ? '...' : ''}`);
        
        // Заполняем выпадающий список
        marks.forEach((mark, index) => {
            const displayText = mark.name || mark.id || `Метка ${index + 1}`;
            const item = document.createElement('div');
            item.classList.add('dropdown-item');
            item.textContent = displayText;
            item.dataset.id = mark.id || '';
            item.dataset.name = mark.name || '';
            item.addEventListener('click', () => this.selectMark(mark.id, mark.name));
            markDropdown.appendChild(item);
        });
        
        // Обновляем информацию о количестве меток
        if (markDetails) {
            markDetails.textContent = `Доступно меток: ${marks.length}`;
        }
        
        // Устанавливаем текущий индекс метки для отображения
        this.state.currentMarkIndex = 0;
    },
    
    // Фильтрация выпадающего списка меток
    filterMarkDropdown: function(query) {
        const markDropdown = document.getElementById('mark-dropdown');
        if (!markDropdown) return;
        
        const items = markDropdown.querySelectorAll('.dropdown-item');
        const lowercaseQuery = query.toLowerCase();
        
        let visibleCount = 0;
        
        items.forEach(item => {
            const text = item.innerText.toLowerCase();
            if (text.includes(lowercaseQuery)) {
                item.style.display = '';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });
        
        // Показываем сообщение если нет совпадений
        let emptyMessage = markDropdown.querySelector('.empty-dropdown');
        if (visibleCount === 0) {
            if (!emptyMessage) {
                emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-dropdown';
                emptyMessage.innerText = 'Нет совпадений';
                markDropdown.appendChild(emptyMessage);
            }
        } else if (emptyMessage) {
            emptyMessage.remove();
        }
    },
    
    // Выбор метки из списка
    selectMark: function(markId, name) {
        console.log(`Выбрана метка: ID = ${markId}, Имя = ${name || 'не указано'}`);
        
        const markInput = document.getElementById('mark-input');
        const markDropdown = document.getElementById('mark-dropdown');
        
        if (!markInput || !markDropdown) {
            console.error('Элементы для выбора метки не найдены');
            return;
        }
        
        let displayText = name;
        
        // Если имя не предоставлено, ищем его в списке меток
        if (!displayText) {
            const mark = this.state.equipmentList.find(m => {
                return (m.id && m.id === markId) || (m.name && m.name === markId);
            });
            
            if (mark) {
                displayText = mark.name || mark.id;
            } else {
                displayText = markId;
            }
        }
        
        // Устанавливаем значение в поле ввода
        markInput.value = displayText;
        markInput.classList.remove('empty');
        
        // Сохраняем выбранную метку
        this.state.selectedMarkId = markId;
        
        // Скрываем выпадающий список
        markDropdown.classList.remove('visible');
        
        // Генерируем QR-код для выбранной метки
        this.generateQRCode();
    },
    
    // Генерация QR-кода
    generateQRCode: function() {
        console.log('Генерация QR-кода');
        
        const qrContainer = document.getElementById('qr-container');
        const markInput = document.getElementById('mark-input');
        const markDetails = document.getElementById('mark-details');
        
        if (!qrContainer) {
            console.error('Контейнер для QR-кода не найден');
            return;
        }
        
        // Очищаем контейнер
        qrContainer.innerHTML = '';
        
        // Определяем текст для QR-кода
        let qrText = '';
        let displayText = '';
        
        if (this.state.selectedMarkId) {
            // Если выбрана метка из списка
            const selectedMark = this.state.equipmentList.find(m => {
                return (m.id && m.id === this.state.selectedMarkId) || 
                       (m.label && m.label === this.state.selectedMarkId);
            });
            
            if (selectedMark) {
                // Используем только label для QR-кода
                qrText = selectedMark.label || '';
                
                // Отображаем информацию в блоке деталей метки
                let detailsText = '';
                if (selectedMark.wagonId) detailsText += `Вагон: ${selectedMark.wagonId}<br>`;
                if (selectedMark.name) detailsText += `Название: ${selectedMark.name}<br>`;
                if (selectedMark.label) detailsText += `Метка: ${selectedMark.label}`;
                
                if (markDetails) {
                    markDetails.innerHTML = detailsText || 'Нет детальной информации';
                    markDetails.style.textAlign = 'center';
                }
            }
        } else if (markInput && markInput.value.trim()) {
            // Если введен текст вручную
            const inputText = markInput.value.trim();
            
            // Пытаемся извлечь метку, если в тексте есть формат "Вагон - Метка (Название)"
            const labelMatch = inputText.match(/- ([^(]+)(?:\s*\(|$)/);
            if (labelMatch && labelMatch[1]) {
                qrText = labelMatch[1].trim();
            } else {
                qrText = inputText.substring(0, 200);
            }
            
            // Отображаем введенный текст в деталях
            if (markDetails) {
                markDetails.innerHTML = `Метка: ${qrText}`;
                markDetails.style.textAlign = 'center';
            }
        }
        
        if (!qrText) {
            console.error('Не указан текст для QR-кода');
            qrContainer.innerHTML = '<div class="empty-state">Введите текст для генерации QR-кода</div>';
            return;
        }
        
        // Создаем QR-код
        try {
            console.log(`Создание QR-кода для текста: ${qrText}`);
            
            const qrCodeElement = document.createElement('div');
            qrCodeElement.id = 'qrcode';
            qrCodeElement.style.margin = '0 auto'; // Центрирование QR-кода
            qrContainer.appendChild(qrCodeElement);
            
            new QRCode(qrCodeElement, {
                text: qrText,
                width: 200,
                height: 200,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M // Снижаем уровень коррекции ошибок для большей вместимости
            });
            
            // Добавляем в историю
            if (!this.state.markHistory.includes(qrText)) {
                this.state.markHistory.push(qrText);
            }
            
            console.log('QR-код успешно создан');
        } catch (error) {
            console.error('Ошибка при создании QR-кода:', error);
            qrContainer.innerHTML = `<div class="empty-state">Ошибка при создании QR-кода: текст слишком длинный</div>`;
        }
        
        // Центрирование кнопок навигации
        const navButtons = document.querySelector('.navigation-buttons');
        if (navButtons) {
            navButtons.style.display = 'flex';
            navButtons.style.justifyContent = 'center';
            navButtons.style.gap = '10px';
            navButtons.style.marginTop = '20px';
        }
    },

    // Показать предыдущую метку
    showPreviousMark: function() {
        if (!this.state.equipmentList || this.state.equipmentList.length === 0) {
            return;
        }
        
        this.state.currentMarkIndex--;
        this.displayCurrentMark();
        
        // Вибрация для тактильной обратной связи на мобильных
        this.provideTactileFeedback();
    },

    // Показать следующую метку
    showNextMark: function() {
        if (!this.state.equipmentList || this.state.equipmentList.length === 0) {
            return;
        }
        
        this.state.currentMarkIndex++;
        this.displayCurrentMark();
        
        // Вибрация для тактильной обратной связи на мобильных
        this.provideTactileFeedback();
    },

    // Тактильная обратная связь для мобильных устройств
    provideTactileFeedback: function() {
        if (this.state.isTouchDevice && 'vibrate' in navigator) {
            navigator.vibrate(50); // Вибрация в миллисекундах
        }
    },

    // Включение/выключение автоматического режима
    toggleAutoMode: function() {
        if (this.state.autoMode) {
            this.stopAutoMode();
        } else {
            this.startAutoMode();
        }
    },

    // Отображение текущей метки и генерация QR-кода
    displayCurrentMark: function() {
        console.log('Отображение текущей метки. Список оборудования:', this.state.equipmentList);
        
        if (!this.state.equipmentList || this.state.equipmentList.length === 0) {
            console.warn('Нет доступных меток для отображения');
            const markDetails = document.getElementById('mark-details');
            if (markDetails) markDetails.textContent = 'Нет данных для отображения';
            return;
        }
        
        // Используем модульную арифметику для зацикливания
        const index = ((this.state.currentMarkIndex % this.state.equipmentList.length) + this.state.equipmentList.length) % this.state.equipmentList.length;
        const mark = this.state.equipmentList[index];
        
        console.log('Отображаем метку:', mark, 'Индекс:', index);
        
        // Выводим информацию о вагоне и оборудовании
        const markDetails = document.getElementById('mark-details');
        if (markDetails) {
            // Формируем информацию о метке
            let detailsText = '';
            if (mark.wagonId) detailsText += `Вагон: ${mark.wagonId}<br>`;
            if (mark.name) detailsText += `Название: ${mark.name}<br>`;
            if (mark.label) detailsText += `Метка: ${mark.label}`;
            
            markDetails.innerHTML = detailsText || 'Нет детальной информации';
            markDetails.style.textAlign = 'center'; // Центрирование текста
        }
        
        // Очистка и обновление поля ввода
        const markInput = document.getElementById('mark-input');
        if (markInput) {
            // Оставляем инпут пустым
            markInput.value = '';
            markInput.classList.add('empty');
            markInput.placeholder = mark.wagonId ? `${mark.wagonId} - ${mark.label || mark.name || 'Метка'}` : (mark.label || mark.name || 'Метка');
            
            // Сохраняем ID текущей метки
            this.state.selectedMarkId = mark.id || mark.label || `${index}`;
        }
        
        // Генерация QR-кода для выбранной метки
        this.generateQRCode();
        
        // Обновление информации в кнопке автоматического режима
        const autoButton = document.getElementById('auto-mode');
        if (autoButton && !this.state.autoMode) {
            autoButton.innerHTML = `<i class="fas fa-sync-alt"></i> Авто режим (${index + 1}/${this.state.equipmentList.length})`;
        }
    },

    // Переход на экран QR-кода
    goToQRScreen: function() {
        console.log('Переход на экран QR-кода');
        
        // Обновляем имя поезда
        const trainNameElement = document.getElementById('qrcode-train-name');
        if (trainNameElement && this.state.selectedTrain) {
            trainNameElement.textContent = this.state.selectedTrain.id;
        }
        
        // Получаем тип оборудования и отображаем его
        const equipmentType = this.state.selectedEquipmentType;
        const equipmentTypeElem = document.getElementById('equipment-type');
        
        if (equipmentTypeElem) {
            let typeName = 'Оборудование';
            
            switch (equipmentType) {
                case 'undercar':
                    typeName = 'Подвагонное оборудование';
                    break;
                case 'salon':
                    typeName = 'Салонное оборудование';
                    break;
                case 'cabin':
                    typeName = 'Кабина';
                    break;
            }
            
            equipmentTypeElem.textContent = typeName;
        }
        
        // Подготавливаем данные для экрана QR-кода
        this.state.currentMarkIndex = 0;
        
        // Заполняем выпадающий список меток
        this.populateMarkDropdown();
        
        // Переход на экран QR-кода
        this.goToScreen('qrcode-screen');
        
        // Отображаем первую метку
        this.displayCurrentMark();
        
        // Отключаем авто-режим при первом открытии
        this.disableAutoMode();
    },

    // Обработка выбора оборудования
    handleEquipmentClick: function(equipment) {
        console.log(`Выбран элемент оборудования:`, equipment);
        this.state.selectedWagon = equipment;
        this.state.equipmentList = equipment.marks || [];
        this.goToQRScreen();
    },

    // Загрузка меток для списка поиска
    populateMarkDropdown: function() {
        const dropdown = document.getElementById('mark-dropdown');
        
        // Проверяем наличие списка оборудования
        if (!this.state.equipmentList || !Array.isArray(this.state.equipmentList) || this.state.equipmentList.length === 0) {
            console.warn('Нет доступных меток для списка');
            dropdown.innerHTML = '<div class="dropdown-item">Нет доступных меток</div>';
            return;
        }
        
        // Очищаем выпадающий список
        dropdown.innerHTML = '';
        
        console.log('Загрузка меток для выпадающего списка:', this.state.equipmentList);
        
        // Добавляем все метки в выпадающий список
        this.state.equipmentList.forEach((mark, index) => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            
            // Сохраняем полный ID метки
            const markId = mark.id || mark.label || `mark-${index}`;
            item.dataset.id = markId;
            
            // Формат: "Вагон - Метка (Название)"
            let displayText = '';
            
            // Добавляем информацию о вагоне
            if (mark.wagonId) {
                displayText += `${mark.wagonId} - `;
            }
            
            // Добавляем информацию о метке и названии
            if (mark.label) {
                displayText += mark.label;
                if (mark.name && mark.name !== mark.label) {
                    displayText += ` (${mark.name})`;
                }
            } else {
                displayText += mark.name || `Метка ${index + 1}`;
            }
            
            console.log(`Создание элемента выпадающего списка: id=${markId}, текст=${displayText}`);
            
            // Устанавливаем текст элемента
            item.textContent = displayText;
            
            // Добавляем обработчик клика на элемент выпадающего списка
            item.addEventListener('click', () => {
                console.log(`Выбрана метка из выпадающего списка: ${markId}`);
                this.selectMarkById(markId);
                dropdown.classList.remove('visible');
            });
            
            dropdown.appendChild(item);
        });
        
        console.log(`Заполнен выпадающий список: ${this.state.equipmentList.length} меток`);
    },

    // Отключение автоматического режима
    disableAutoMode: function() {
        console.log('Отключение автоматического режима');
        
        // Остановка таймера, если он запущен
        if (this.state.autoModeTimer) {
            clearInterval(this.state.autoModeTimer);
            this.state.autoModeTimer = null;
        }
        
        // Обновление состояния и кнопки
        this.state.autoMode = false;
        
        const autoButton = document.getElementById('auto-mode');
        const timerElement = document.querySelector('.circle-timer');
        
        if (autoButton) {
            autoButton.classList.remove('timing');
            autoButton.innerHTML = `<i class="fas fa-sync-alt"></i> Авто режим`;
            
            // Обновление статуса с учетом количества меток
            if (this.state.equipmentList && this.state.equipmentList.length > 0) {
                autoButton.innerHTML += ` (1/${this.state.equipmentList.length})`;
            }
        }
        
        // Удаляем таймер из интерфейса, если он существует
        if (timerElement) {
            timerElement.remove();
        }
    },

    // Выбор метки по ID
    selectMarkById: function(markId) {
        console.log(`Выбор метки по ID: ${markId}`);
        
        // Проверяем наличие меток
        if (!this.state.equipmentList || !Array.isArray(this.state.equipmentList)) {
            console.warn('Нет доступных меток для выбора');
            return;
        }
        
        // Ищем метку по ID
        const mark = this.state.equipmentList.find(m => 
            (m.id && m.id === markId) || 
            (m.label && m.label === markId)
        );
        
        if (!mark) {
            console.warn(`Метка с ID ${markId} не найдена`);
            return;
        }
        
        // Сохраняем ID выбранной метки
        this.state.selectedMarkId = markId;
        this.state.currentMarkIndex = this.state.equipmentList.indexOf(mark);
        
        // Отображаем выбранную метку
        this.displayCurrentMark();
    },

    // Обработка выбора метки из выпадающего списка
    handleMarkInputKeydown: function(e) {
        const dropdown = document.getElementById('mark-dropdown');
        if (!dropdown || !dropdown.classList.contains('visible')) return;
        
        const items = Array.from(dropdown.querySelectorAll('.dropdown-item:not([style*="display: none"])'));
        if (items.length === 0) return;
        
        const currentItem = dropdown.querySelector('.dropdown-item.selected');
        let currentIndex = currentItem ? items.indexOf(currentItem) : -1;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (currentIndex < items.length - 1) {
                    currentIndex++;
                } else {
                    currentIndex = 0;
                }
                this.highlightMarkItem(items[currentIndex]);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                if (currentIndex > 0) {
                    currentIndex--;
                } else {
                    currentIndex = items.length - 1;
                }
                this.highlightMarkItem(items[currentIndex]);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (currentItem) {
                    const markId = currentItem.dataset.id;
                    this.selectMarkById(markId);
                    dropdown.classList.remove('visible');
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                dropdown.classList.remove('visible');
                break;
        }
    },
    
    // Выделение метки в выпадающем списке
    highlightMarkItem: function(item) {
        if (!item) return;
        
        const dropdown = document.getElementById('mark-dropdown');
        if (!dropdown) return;
        
        // Снимаем выделение со всех элементов
        dropdown.querySelectorAll('.dropdown-item').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Выделяем текущий элемент
        item.classList.add('selected');
        
        // Прокручиваем к выделенному элементу, если он не виден
        if (!this.isElementVisible(item, dropdown)) {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },

    // Отображение выпадающего списка меток
    showMarkDropdown: function() {
        const dropdown = document.getElementById('mark-dropdown');
        if (dropdown) {
            dropdown.classList.add('visible');
        }
    },
    
    // Скрытие выпадающего списка меток
    hideMarkDropdown: function() {
        const dropdown = document.getElementById('mark-dropdown');
        if (dropdown) {
            dropdown.classList.remove('visible');
        }
    },
};

// Сервис для работы с данными
const DataService = {
    // Получение списка поездов
    getTrainList: function() {
        return fetch('data/trains.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            });
    },
    
    // Получение данных о поезде
    getTrainData: function(dataFile) {
        const url = `data/trains/${dataFile}`;
        console.log(`Запрос данных поезда по URL: ${url}`);
        
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    console.error(`Ошибка HTTP при загрузке данных поезда: ${response.status} ${response.statusText}`);
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log(`Успешно загружены данные поезда. Состав: ${data.composition}, вагонов: ${data.wagons ? data.wagons.length : 0}`);
                return data;
            });
    }
}; 
import TodoItem from "./components/TodoItem.js";

class TodoApp {
  constructor() {
    this.todos = JSON.parse(localStorage.getItem("todos")) || [];
    this.currentFilter = "active";
    this.todoList = document.getElementById("todo-list");
    this.newTodoInput = document.getElementById("new-todo");
    this.addTodoBtn = document.getElementById("add-todo");
    this.filterBtns = document.querySelectorAll(".filter-btn");

    // 添加依赖关系相关状态
    this.dependencySelectionActive = false;
    this.dependencySourceId = null;

    // 添加搜索相关状态
    this.searchInput = document.getElementById("search-todo");
    this.clearSearchBtn = document.getElementById("clear-search");
    this.searchTerm = "";

    // 添加主题切换相关
    this.themeToggle = document.getElementById("theme-toggle");
    this.currentTheme = localStorage.getItem("theme") || "light";
    document.documentElement.dataset.theme = this.currentTheme;

    this.initEventListeners();
    this.loadTodos();
  }

  initEventListeners() {
    // 添加新待办事项
    this.addTodoBtn.addEventListener("click", () => this.addTodo());
    this.newTodoInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.addTodo();
    });

    // 过滤按钮
    this.filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.currentFilter = btn.dataset.filter;
        this.filterBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.renderTodos();
      });
    });

    // 自定义事件监听
    document.addEventListener("todo-updated", (e) => this.updateTodo(e.detail));
    document.addEventListener("todo-deleted", (e) => this.deleteTodo(e.detail));

    // 添加依赖关系相关事件监听
    document.addEventListener("todo-add-dependency", (e) =>
      this.startDependencySelection(e.detail.id)
    );
    document.addEventListener("todo-toggle-complete", (e) =>
      this.handleToggleComplete(e.detail)
    );
    document.addEventListener("todo-set-estimate", (e) =>
      this.showEstimateDialog(e.detail.id)
    );

    // 添加取消依赖选择的事件
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.dependencySelectionActive) {
        this.cancelDependencySelection();
      }
    });

    // 添加移除依赖事件监听
    document.addEventListener("todo-remove-dependency", (e) =>
      this.removeDependency(e.detail.todoId, e.detail.dependencyId)
    );

    // 添加预估耗时事件监听
    document.addEventListener("todo-set-hours", (e) =>
      this.showHoursDialog(e.detail.id)
    );

    // 添加搜索事件监听
    this.searchInput.addEventListener("input", () => {
      this.searchTerm = this.searchInput.value.trim().toLowerCase();
      this.renderTodos();
    });

    this.clearSearchBtn.addEventListener("click", () => {
      this.searchInput.value = "";
      this.searchTerm = "";
      this.renderTodos();
    });

    // 添加前置任务跳转高亮事件监听
    document.addEventListener("todo-highlight", (e) =>
      this.highlightTask(e.detail.id)
    );

    // 添加主题切换事件监听
    this.themeToggle.addEventListener("click", () => {
      this.currentTheme = this.currentTheme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = this.currentTheme;
      localStorage.setItem("theme", this.currentTheme);
    });
  }

  loadTodos() {
    this.todos = JSON.parse(localStorage.getItem("todos")) || [];
    // 将普通对象转换为 TodoItem 实例
    this.todos = this.todos.map((todo) => {
      const item = new TodoItem(todo.id, todo.content, todo.completed);
      item.createdAt = new Date(todo.createdAt);

      // 加载依赖关系
      if (todo.dependencies) {
        item.dependencies = todo.dependencies;
      }

      // 加载截止时间
      if (todo.estimatedCompletionDate) {
        item.estimatedCompletionDate = todo.estimatedCompletionDate;
      }

      // 加载预估耗时
      if (todo.estimatedHours) {
        item.estimatedHours = todo.estimatedHours;
      }

      return item;
    });
    this.renderTodos();
  }

  saveTodos() {
    localStorage.setItem("todos", JSON.stringify(this.todos));
  }

  addTodo() {
    const content = this.newTodoInput.value.trim();
    if (content) {
      const id = Date.now().toString();
      const newTodo = new TodoItem(id, content);
      this.todos.unshift(newTodo);
      this.saveTodos();
      this.renderTodos();
      this.newTodoInput.value = "";
    }
  }

  updateTodo(updatedTodo) {
    const index = this.todos.findIndex((todo) => todo.id === updatedTodo.id);
    if (index !== -1) {
      this.todos[index] = updatedTodo;
      this.saveTodos();
      this.renderTodos();
    }
  }

  deleteTodo(todoId) {
    this.todos = this.todos.filter((todo) => todo.id !== todoId);
    this.saveTodos();
    this.renderTodos();
  }

  renderTodos() {
    // 计算任务时间
    this.calculateTaskTimes();

    this.todoList.innerHTML = "";

    // 先过滤分类
    let filteredTodos = this.todos.filter((todo) => {
      if (this.currentFilter === "all") return true;
      if (this.currentFilter === "active") return !todo.completed;
      if (this.currentFilter === "completed") return todo.completed;
      return true;
    });

    // 再过滤搜索词
    if (this.searchTerm) {
      filteredTodos = filteredTodos.filter((todo) =>
        todo.content.toLowerCase().includes(this.searchTerm)
      );
    }

    if (filteredTodos.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "empty-message";

      if (this.searchTerm) {
        emptyMessage.textContent = `没有找到包含 "${this.searchTerm}" 的待办事项`;
      } else {
        emptyMessage.textContent = "没有待办事项";
      }

      this.todoList.appendChild(emptyMessage);
      return;
    }

    filteredTodos.forEach((todo) => {
      const todoElement = todo.createCardElement();
      this.todoList.appendChild(todoElement);

      // 更新依赖列表
      todo.updateDependencyList(this.todos, todoElement);
    });

    // 添加任务路径可视化
    this.renderTaskPathVisualization();

    // 计算任务的预计开始和结束时间
    this.calculateTaskTimes();
  }

  // 开始依赖选择模式
  startDependencySelection(sourceId) {
    this.dependencySelectionActive = true;
    this.dependencySourceId = sourceId;

    // 显示依赖选择模式的提示
    const notification = document.createElement("div");
    notification.className = "dependency-selection-notification";
    notification.textContent = "请选择前置任务，或按 ESC 取消";
    document.body.appendChild(notification);

    // 为所有可能的依赖项添加选择样式
    const sourceTodo = this.todos.find((todo) => todo.id === sourceId);

    this.todoList.querySelectorAll(".todo-card").forEach((card) => {
      const todoId = card.dataset.id;

      // 不能选择自己或已经是依赖的项
      if (todoId !== sourceId && !sourceTodo.dependencies.includes(todoId)) {
        card.classList.add("selectable-dependency");

        // 添加临时点击事件
        card.addEventListener("click", this.handleDependencySelection);
        card.dataset.selectable = "true";
      }
    });
  }

  // 处理依赖选择
  handleDependencySelection = (e) => {
    const targetCard = e.currentTarget;
    const targetId = targetCard.dataset.id;

    if (targetCard.dataset.selectable === "true") {
      // 检查是否会形成循环依赖
      if (this.wouldCreateCyclicDependency(targetId, this.dependencySourceId)) {
        alert("无法添加此依赖，会形成循环依赖！");
      } else {
        // 添加依赖关系
        const sourceTodo = this.todos.find(
          (todo) => todo.id === this.dependencySourceId
        );
        if (sourceTodo.addDependency(targetId)) {
          this.saveTodos();
          this.renderTodos();
        }
      }

      this.cancelDependencySelection();
    }
  };

  // 取消依赖选择模式
  cancelDependencySelection() {
    this.dependencySelectionActive = false;
    this.dependencySourceId = null;

    // 移除通知
    const notification = document.querySelector(
      ".dependency-selection-notification"
    );
    if (notification) {
      notification.remove();
    }

    // 移除所有选择样式和临时事件
    this.todoList.querySelectorAll(".selectable-dependency").forEach((card) => {
      card.classList.remove("selectable-dependency");
      card.removeEventListener("click", this.handleDependencySelection);
      card.dataset.selectable = "false";
    });
  }

  // 检查是否会形成循环依赖
  wouldCreateCyclicDependency(dependencyId, sourceId) {
    // 如果依赖项依赖于源，则会形成循环
    const dependency = this.todos.find((todo) => todo.id === dependencyId);

    // 直接循环检查
    if (dependency.dependencies.includes(sourceId)) {
      return true;
    }

    // 递归检查更深层次的依赖
    return this.checkCyclicDependencyRecursive(
      dependency.dependencies,
      sourceId
    );
  }

  // 递归检查循环依赖
  checkCyclicDependencyRecursive(dependencyIds, sourceId) {
    for (const depId of dependencyIds) {
      const dependency = this.todos.find((todo) => todo.id === depId);

      if (
        dependency.id === sourceId ||
        dependency.dependencies.includes(sourceId) ||
        this.checkCyclicDependencyRecursive(dependency.dependencies, sourceId)
      ) {
        return true;
      }
    }

    return false;
  }

  // 处理完成状态切换
  handleToggleComplete(todo) {
    const todoItem = this.todos.find(t => t.id === todo.id);
    if (!todoItem) return;

    if (todoItem.completed) {
      // 取消完成时，递归取消所有依赖于此任务的任务的完成状态
      this.cancelCompletionForDependentTasks(todoItem.id);
    } else {
      // 完成任务时的检查
      if (!todoItem.canComplete(this.todos)) {
        alert('请先完成所有前置任务！');
        return;
      }
    }
    
    todoItem.completed = !todoItem.completed;
    this.saveTodos();
    this.renderTodos();
  }

  // 添加递归取消下游任务完成状态的方法
  cancelCompletionForDependentTasks(taskId) {
    // 找出所有直接依赖于此任务的任务
    const dependentTasks = this.todos.filter(todo => 
      todo.dependencies.includes(taskId) && todo.completed
    );
    
    // 取消这些任务的完成状态
    dependentTasks.forEach(task => {
      task.completed = false;
      // 递归处理依赖于这些任务的其他任务
      this.cancelCompletionForDependentTasks(task.id);
    });
  }

  // 显示设置截止时间的对话框
  showEstimateDialog(todoId) {
    const todo = this.todos.find((t) => t.id === todoId);
    if (!todo) return;

    // 创建日期时间选择对话框
    const dialog = document.createElement("div");
    dialog.className = "estimate-dialog";

    const title = document.createElement("h3");
    title.textContent = "设置截止时间";

    const container = document.createElement("div");
    container.className = "datetime-container";

    // 日期选择
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.className = "estimate-date-input";

    // 时间选择
    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.className = "estimate-time-input";

    // 如果已有日期，设置为默认值
    if (todo.estimatedCompletionDate) {
      const date = new Date(todo.estimatedCompletionDate);
      dateInput.value = date.toISOString().split("T")[0];

      // 格式化时间为 HH:MM
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      timeInput.value = `${hours}:${minutes}`;
    } else {
      // 默认设置为明天同一时间
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.value = tomorrow.toISOString().split("T")[0];

      // 当前时间
      const hours = tomorrow.getHours().toString().padStart(2, "0");
      const minutes = tomorrow.getMinutes().toString().padStart(2, "0");
      timeInput.value = `${hours}:${minutes}`;
    }

    container.appendChild(dateInput);
    container.appendChild(timeInput);

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "dialog-buttons";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "保存";
    saveBtn.addEventListener("click", () => {
      const dateValue = dateInput.value;
      const timeValue = timeInput.value;

      if (dateValue && timeValue) {
        // 组合日期和时间
        const [year, month, day] = dateValue.split("-");
        const [hours, minutes] = timeValue.split(":");

        const deadline = new Date(year, month - 1, day, hours, minutes);
        todo.setEstimatedCompletionDate(deadline);
        this.updateTodo(todo);
      }
      document.body.removeChild(dialog);
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(dialog);
    });

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "清除截止时间";
    clearBtn.addEventListener("click", () => {
      todo.setEstimatedCompletionDate(null);
      this.updateTodo(todo);
      document.body.removeChild(dialog);
    });

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(clearBtn);
    buttonContainer.appendChild(cancelBtn);

    dialog.appendChild(title);
    dialog.appendChild(container);
    dialog.appendChild(buttonContainer);

    document.body.appendChild(dialog);
  }

  // 添加任务路径可视化
  renderTaskPathVisualization() {
    // 如果已存在可视化，先移除
    const existingViz = document.querySelector(".task-path-visualization");
    if (existingViz) {
      existingViz.remove();
    }

    // 创建可视化容器
    const vizContainer = document.createElement("div");
    vizContainer.className = "task-path-visualization";

    // 添加标题
    const vizTitle = document.createElement("h3");
    vizTitle.textContent = "任务依赖路径";
    vizContainer.appendChild(vizTitle);

    // 创建可视化内容
    const vizContent = document.createElement("div");
    vizContent.className = "task-path-content";

    // 找出所有没有完成 且 没有被其他任务依赖的任务（终点任务）
    const endTasks = this.todos.filter(
      (todo) => !todo.completed && !this.todos.some((t) => t.dependencies.includes(todo.id))
    );

    // 为每个终点任务创建一个路径
    endTasks.forEach((endTask) => {
      const pathElement = this.createTaskPathElement(endTask);
      if (pathElement) {
        vizContent.appendChild(pathElement);
      }
    });

    vizContainer.appendChild(vizContent);

    // 如果有路径，添加到页面
    if (vizContent.children.length > 0) {
      this.todoList.parentNode.insertBefore(
        vizContainer,
        this.todoList.nextSibling
      );
    }
  }

  // 创建任务路径元素
  createTaskPathElement(task, level = 0, visited = new Set()) {
    if (visited.has(task.id)) return null;
    visited.add(task.id);

    const pathElement = document.createElement('div');
    pathElement.className = 'task-path-item';
    pathElement.style.marginLeft = `${level * 20}px`;

    const taskContent = document.createElement('div');
    taskContent.className = `task-path-content ${task.completed ? "completed" : ""}`;

    // 显示任务状态
    let taskStatus = '';
    if (task.completed) {
      taskStatus = '✓ ';
    } else if (!task.canComplete(this.todos)) {
      taskStatus = '⏳ ';
    } else {
      taskStatus = '➡️ ';
    }

    taskContent.textContent = `${taskStatus} ${task.content}`;

    // 修改时间显示
    if (task.estimatedCompletionDate) {
      const deadlineDate = new Date(task.estimatedCompletionDate);
      const today = new Date();
      
      const hoursLeft = (deadlineDate - today) / (1000 * 60 * 60);
      
      const deadlineInfo = document.createElement('span');
      deadlineInfo.className = 'task-path-estimate';
      
      if (hoursLeft < 0) {
        deadlineInfo.textContent = `(已逾期 ${this.formatTimeLeft(hoursLeft)})`;
        deadlineInfo.classList.add('overdue');
      } else if (hoursLeft === 0) {
        deadlineInfo.textContent = `(今天到期)`;
        deadlineInfo.classList.add('due-today');
      } else {
        const formattedTime = deadlineDate.toLocaleString("zh-CN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        deadlineInfo.textContent = `【截止 ${formattedTime}，还剩 ${this.formatTimeLeft(hoursLeft)}】`;
      }
      
      taskContent.appendChild(deadlineInfo);
    }

    // 添加预估耗时
    if (task.estimatedHours > 0) {
      const hoursInfo = document.createElement("span");
      hoursInfo.className = "task-path-hours";
      hoursInfo.textContent = `(${task.estimatedHours}小时)`;
      taskContent.appendChild(hoursInfo);
    }

    // 添加计算的完成时间和延期状态
    if (task.calculatedEndTime && !task.completed) {
      const calculatedInfo = document.createElement("span");
      calculatedInfo.className = `task-path-calculated ${task.delayStatus}`;

      const formattedTime = task.calculatedEndTime.toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      calculatedInfo.textContent = ` → ${formattedTime}`;

      if (task.delayStatus === "delayed") {
        calculatedInfo.textContent += " (预计延期!)";
      } else if (task.delayStatus === "warning") {
        calculatedInfo.textContent += " (即将延期!)";
      }

      taskContent.appendChild(calculatedInfo);
    }

    pathElement.appendChild(taskContent);

    // 添加点击高亮功能，直接使用当前任务的ID
    pathElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.highlightTask(task.id);
    });

    // 只显示未完成的依赖任务
    if (task.dependencies.length > 0) {
      const dependenciesContainer = document.createElement('div');
      dependenciesContainer.className = 'task-path-dependencies';

      task.dependencies.forEach(depId => {
        const dependency = this.todos.find(t => t.id === depId);
        if (dependency) {
          const depElement = this.createTaskPathElement(
            dependency,
            level + 1,
            new Set(visited)
          );
          if (depElement) {
            dependenciesContainer.appendChild(depElement);
          }
        }
      });

      if (dependenciesContainer.children.length > 0) {
        pathElement.appendChild(dependenciesContainer);
      }
    }

    return pathElement;
  }

  // 添加移除依赖方法
  removeDependency(todoId, dependencyId) {
    const todo = this.todos.find((t) => t.id === todoId);
    if (todo) {
      todo.removeDependency(dependencyId);
      this.saveTodos();
      this.renderTodos();
    }
  }

  // 添加显示设置预估耗时对话框的方法
  showHoursDialog(todoId) {
    const todo = this.todos.find((t) => t.id === todoId);
    if (!todo) return;

    // 创建耗时设置对话框
    const dialog = document.createElement("div");
    dialog.className = "hours-dialog";

    const title = document.createElement("h3");
    title.textContent = "设置预估耗时（小时）";

    const hoursInput = document.createElement("input");
    hoursInput.type = "number";
    hoursInput.min = "0";
    hoursInput.step = "0.5";
    hoursInput.className = "hours-input";
    hoursInput.value = todo.estimatedHours || "";
    hoursInput.placeholder = "例如: 2.5";

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "dialog-buttons";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "保存";
    saveBtn.addEventListener("click", () => {
      const hoursValue = hoursInput.value;
      todo.setEstimatedHours(hoursValue);
      this.updateTodo(todo);
      document.body.removeChild(dialog);
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(dialog);
    });

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);

    dialog.appendChild(title);
    dialog.appendChild(hoursInput);
    dialog.appendChild(buttonContainer);

    document.body.appendChild(dialog);
  }

  // 计算任务的预计开始和结束时间
  calculateTaskTimes() {
    // 首先重置所有任务的计算时间
    this.todos.forEach((todo) => {
      todo.calculatedStartTime = null;
      todo.calculatedEndTime = null;
    });

    // 找出所有没有依赖的任务作为起点
    const startTasks = this.todos.filter(
      (todo) => !todo.completed && todo.dependencies.length === 0
    );

    // 从每个起点任务开始计算
    startTasks.forEach((task) => {
      this.calculateTaskTime(task);
    });

    // 更新任务状态（是否延期）
    this.updateTaskDelayStatus();
  }

  // 递归计算单个任务的时间
  calculateTaskTime(task, visited = new Set()) {
    // 防止循环依赖
    if (visited.has(task.id)) return;
    visited.add(task.id);

    // 如果任务已完成，不需要计算
    if (task.completed) return;

    // 计算所有依赖任务的结束时间
    const dependencyEndTimes = [];

    for (const depId of task.dependencies) {
      const dependency = this.todos.find((todo) => todo.id === depId);
      if (!dependency) continue;

      // 如果依赖已完成，不考虑其时间
      if (dependency.completed) continue;

      // 如果依赖还没有计算过结束时间，先计算
      if (!dependency.calculatedEndTime) {
        this.calculateTaskTime(dependency, new Set(visited));
      }

      // 如果依赖有计算结束时间，加入列表
      if (dependency.calculatedEndTime) {
        dependencyEndTimes.push(dependency.calculatedEndTime);
      }
    }

    // 确定任务开始时间（当前时间或所有依赖的最晚结束时间）
    let startTime = new Date();
    if (dependencyEndTimes.length > 0) {
      // 找出所有依赖中最晚的结束时间
      const latestDependencyEnd = new Date(
        Math.max(...dependencyEndTimes.map((d) => d.getTime()))
      );
      startTime =
        latestDependencyEnd > startTime ? latestDependencyEnd : startTime;
    }

    // 设置任务的计算开始时间
    task.calculatedStartTime = startTime;

    // 计算任务的结束时间（开始时间 + 预估耗时）
    const endTime = new Date(startTime.getTime());
    endTime.setHours(endTime.getHours() + (task.estimatedHours || 1)); // 默认1小时

    // 设置任务的计算结束时间
    task.calculatedEndTime = endTime;

    // 递归计算依赖于此任务的其他任务
    const dependentTasks = this.todos.filter(
      (t) => !t.completed && t.dependencies.includes(task.id)
    );

    dependentTasks.forEach((depTask) => {
      this.calculateTaskTime(depTask, new Set(visited));
    });
  }

  // 更新任务延期状态
  updateTaskDelayStatus() {
    this.todos.forEach((todo) => {
      if (
        todo.completed ||
        !todo.calculatedEndTime ||
        !todo.estimatedCompletionDate
      ) {
        todo.delayStatus = "normal";
        return;
      }

      const deadline = new Date(todo.estimatedCompletionDate);
      const calculatedEnd = todo.calculatedEndTime;

      // 计算时间差（小时）
      const diffHours = (deadline - calculatedEnd) / (1000 * 60 * 60);

      if (diffHours < 0) {
        // 预计完成时间已经超过截止时间
        todo.delayStatus = "delayed";
      } else if (diffHours <= 1) {
        // 预计完成时间接近截止时间（1小时内）
        todo.delayStatus = "warning";
      } else {
        // 正常
        todo.delayStatus = "normal";
      }
    });
  }

  // 修改高亮方法，使高亮效果持续3秒
  highlightTask(taskId) {
    // 先移除所有高亮
    document.querySelectorAll(".todo-card.highlighted").forEach((card) => {
      card.classList.remove("highlighted");
    });

    // 高亮对应任务
    const taskCard = document.querySelector(`.todo-card[data-id="${taskId}"]`);
    if (taskCard) {
      taskCard.classList.add("highlighted");

      // 滚动到该任务
      taskCard.scrollIntoView({ behavior: "smooth", block: "center" });

      // 3秒后移除高亮
      setTimeout(() => {
        taskCard.classList.remove("highlighted");
      }, 3000);
    }
  }

  // 修改时间显示格式的辅助函数
  formatTimeLeft(hours) {
    if (Math.abs(hours) >= 24) {
      const days = Math.floor(Math.abs(hours) / 24);
      return `${days} 天`;
    } else {
      return `${Math.ceil(Math.abs(hours))} 小时`;
    }
  }
}

// 初始化应用
document.addEventListener("DOMContentLoaded", () => {
  new TodoApp();
});

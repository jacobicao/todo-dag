export default class TodoItem {
  constructor(id, content, completed = false) {
    this.id = id;
    this.content = content;
    this.completed = completed;
    this.createdAt = new Date();
    this.dependencies = [];
    this.estimatedCompletionDate = null;
    this.estimatedHours = 0;
    this.calculatedEndTime = null;
    this.delayStatus = "normal";
  }

  createCardElement() {
    const card = document.createElement("div");
    card.className = `todo-card ${this.completed ? "completed" : ""}`;
    card.dataset.id = this.id;

    const content = document.createElement("div");
    content.className = "todo-content";
    content.textContent = this.content;

    const infoContainer = document.createElement("div");
    infoContainer.className = "todo-info-container";

    const date = document.createElement("div");
    date.className = "todo-date";
    date.textContent = this.formatDate();
    infoContainer.appendChild(date);

    // 截止时间
    if (this.estimatedCompletionDate) {
      const estimatedDate = document.createElement("div");
      estimatedDate.className = "todo-estimated-date";
      const deadline = new Date(this.estimatedCompletionDate);
      const formattedDeadline = deadline.toLocaleString("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      estimatedDate.textContent = `截止时间: ${formattedDeadline}`;
      infoContainer.appendChild(estimatedDate);
    }

    // 预计完成时间
    if (this.calculatedEndTime && !this.completed) {
      const calculatedTimeContainer = document.createElement("div");
      calculatedTimeContainer.className = "todo-calculated-container";

      const calculatedTimeElement = document.createElement("div");
      calculatedTimeElement.className = "todo-calculated-time";

      const formattedTime = this.calculatedEndTime.toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      calculatedTimeElement.textContent = `预计完成于: ${formattedTime}`;
      calculatedTimeContainer.appendChild(calculatedTimeElement);

      // 延期状态显示
      if (this.delayStatus !== "normal") {
        const warningElement = document.createElement("div");
        warningElement.className = `delay-warning ${this.delayStatus}`;

        const warningIcon = document.createElement("span");
        warningIcon.className = "delay-warning-icon";
        warningIcon.textContent = "⚠️ ";
        warningElement.appendChild(warningIcon);

        const warningText = document.createElement("span");
        warningText.className = "delay-warning-text";
        warningText.textContent =
          this.delayStatus === "delayed" ? "预计延期!" : "即将延期!";
        warningElement.appendChild(warningText);

        calculatedTimeContainer.appendChild(warningElement);
      }

      infoContainer.appendChild(calculatedTimeContainer);
    }

    // 预估耗时
    if (this.estimatedHours > 0) {
      const estimatedHours = document.createElement("div");
      estimatedHours.className = "todo-estimated-hours";
      estimatedHours.textContent = `预计耗时: ${this.estimatedHours} 小时`;
      infoContainer.appendChild(estimatedHours);
    }

    // 依赖关系
    const dependencies = document.createElement("div");
    dependencies.className = "todo-dependencies";

    if (this.dependencies.length > 0) {
      dependencies.innerHTML = `<span class="dependency-title">前置任务:</span>`;
      const dependencyList = document.createElement("ul");
      dependencyList.className = "dependency-list";
      dependencies.appendChild(dependencyList);
    }

    const actions = document.createElement("div");
    actions.className = "todo-actions";

    const completeBtn = document.createElement("button");
    completeBtn.className = "complete-btn";
    completeBtn.textContent = this.completed ? "取消完成" : "完成";
    completeBtn.addEventListener("click", () => this.toggleComplete());

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "删除";
    deleteBtn.addEventListener("click", () => this.delete());

    const dependencyBtn = document.createElement("button");
    dependencyBtn.className = "dependency-btn";
    dependencyBtn.textContent = "添加前置任务";
    dependencyBtn.addEventListener("click", () => {
      document.dispatchEvent(
        new CustomEvent("todo-add-dependency", {
          detail: { id: this.id },
        })
      );
    });

    const estimateBtn = document.createElement("button");
    estimateBtn.className = "estimate-btn";
    estimateBtn.textContent = "设置截止时间";
    estimateBtn.addEventListener("click", () => {
      document.dispatchEvent(
        new CustomEvent("todo-set-estimate", {
          detail: { id: this.id },
        })
      );
    });

    const hoursBtn = document.createElement("button");
    hoursBtn.className = "hours-btn";
    hoursBtn.textContent = "设置预估耗时";
    hoursBtn.addEventListener("click", () => {
      document.dispatchEvent(
        new CustomEvent("todo-set-hours", {
          detail: { id: this.id },
        })
      );
    });

    actions.appendChild(completeBtn);
    actions.appendChild(deleteBtn);

    const secondaryActions = document.createElement("div");
    secondaryActions.className = "secondary-actions";
    secondaryActions.appendChild(dependencyBtn);
    secondaryActions.appendChild(estimateBtn);
    secondaryActions.appendChild(hoursBtn);

    card.appendChild(content);
    card.appendChild(infoContainer);

    if (this.dependencies.length > 0) {
      card.appendChild(dependencies);
    }

    card.appendChild(actions);
    card.appendChild(secondaryActions);

    return card;
  }

  formatDate() {
    return `创建于: ${this.createdAt.toLocaleString("zh-CN")}`;
  }

  toggleComplete() {
    document.dispatchEvent(
      new CustomEvent("todo-toggle-complete", {
        detail: this,
      })
    );
  }

  delete() {
    document.dispatchEvent(
      new CustomEvent("todo-deleted", { detail: this.id })
    );
  }

  updateDependencyList(todoList, element) {
    const dependencyListElement = element.querySelector(".dependency-list");
    if (!dependencyListElement) return;

    dependencyListElement.innerHTML = "";

    this.dependencies.forEach((depId) => {
      const dependency = todoList.find((todo) => todo.id === depId);
      if (dependency) {
        const li = document.createElement("li");
        li.className = `dependency-item ${dependency.completed ? "completed" : ""}`;

        // 创建依赖项内容和删除按钮的容器
        const itemContent = document.createElement("span");
        itemContent.className = "dependency-item-content";
        itemContent.textContent = dependency.content;

        // 添加点击跳转功能
        itemContent.addEventListener("click", (e) => {
          e.stopPropagation();
          document.dispatchEvent(
            new CustomEvent("todo-highlight", {
              detail: { id: depId },
            })
          );
        });

        // 创建删除按钮
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-dependency-btn";
        removeBtn.innerHTML = "&times;";
        removeBtn.title = "移除前置任务";
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          document.dispatchEvent(
            new CustomEvent("todo-remove-dependency", {
              detail: { todoId: this.id, dependencyId: depId },
            })
          );
        });

        li.appendChild(itemContent);
        li.appendChild(removeBtn);
        dependencyListElement.appendChild(li);
      }
    });
  }

  addDependency(dependencyId) {
    if (!this.dependencies.includes(dependencyId) && dependencyId !== this.id) {
      this.dependencies.push(dependencyId);
      return true;
    }
    return false;
  }

  removeDependency(dependencyId) {
    this.dependencies = this.dependencies.filter((id) => id !== dependencyId);
  }

  setEstimatedCompletionDate(date) {
    this.estimatedCompletionDate = date;
  }

  canComplete(todoList) {
    if (this.dependencies.length === 0) return true;

    return this.dependencies.every((depId) => {
      const dependency = todoList.find((todo) => todo.id === depId);
      return dependency && dependency.completed;
    });
  }

  setEstimatedHours(hours) {
    this.estimatedHours = parseFloat(hours) || 0;
  }
}

const STORAGE_KEY = "familyBudgetData.v1"
const THEME_KEY = "budgetTheme"

let state = {
  incomes: [],
  expenses: [],
  plans: []
}

let chart
let plannedMonthlyChart

const refs = {
  incomeName: document.getElementById("incomeName"),
  incomeAmount: document.getElementById("incomeAmount"),
  expenseName: document.getElementById("expenseName"),
  expenseGroup: document.getElementById("expenseGroup"),
  expenseAmount: document.getElementById("expenseAmount"),
  planName: document.getElementById("planName"),
  planAmount: document.getElementById("planAmount"),
  planDate: document.getElementById("planDate"),
  incomeBody: document.getElementById("incomeBody"),
  expenseBody: document.getElementById("expenseBody"),
  expenseGroupBody: document.getElementById("expenseGroupBody"),
  planBody: document.getElementById("planBody"),
  plannedMonthlyList: document.getElementById("plannedMonthlyList"),
  totalIncome: document.getElementById("totalIncome"),
  totalExpense: document.getElementById("totalExpense"),
  balance: document.getElementById("balance"),
  themeToggleBtn: document.getElementById("themeToggleBtn")
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function money(value) {
  return Number(value).toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.incomes) && Array.isArray(parsed.expenses) && Array.isArray(parsed.plans)) {
      state = parsed
    }
  } catch (error) {
    console.warn("Не удалось загрузить сохраненный бюджет", error)
  }
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark-theme")
    refs.themeToggleBtn.innerText = "☀ Светлая тема"
  } else {
    document.body.classList.remove("dark-theme")
    refs.themeToggleBtn.innerText = "🌙 Тёмная тема"
  }
}

function toggleTheme() {
  const next = document.body.classList.contains("dark-theme") ? "light" : "dark"
  localStorage.setItem(THEME_KEY, next)
  applyTheme(next)
}

function createChart() {
  const ctx = document.getElementById("expenseChart")
  chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: ["#ff6384", "#36a2eb", "#ffce56", "#4bc0c0", "#9966ff", "#ff9f40", "#10b981", "#22c55e"]
      }]
    },
    options: { responsive: true }
  })
}

function createPlannedMonthlyChart() {
  const ctx = document.getElementById("plannedMonthlyChart")
  plannedMonthlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [{
        label: "Запланированные расходы",
        data: [],
        backgroundColor: "#8b5cf6"
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  })
}

function getExpenseCategories() {
  return state.expenses.reduce((acc, item) => {
    acc[item.name] = (acc[item.name] || 0) + Number(item.amount)
    return acc
  }, {})
}

function updateChart() {
  const categories = getExpenseCategories()
  chart.data.labels = Object.keys(categories)
  chart.data.datasets[0].data = Object.values(categories)
  chart.update()
}

function computeTotals() {
  const totalIncome = state.incomes.reduce((sum, item) => sum + Number(item.amount), 0)
  const totalExpense = state.expenses.reduce((sum, item) => sum + Number(item.amount), 0)
  return { totalIncome, totalExpense, balance: totalIncome - totalExpense }
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-")
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
}

function getPlannedMonthlyTotals() {
  const monthly = state.plans.reduce((acc, item) => {
    const key = String(item.date || "").slice(0, 7)
    if (!key) return acc
    acc[key] = (acc[key] || 0) + Number(item.amount)
    return acc
  }, {})
  return Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0]))
}

function renderPlannedMonthlySummary() {
  const totals = getPlannedMonthlyTotals()
  refs.plannedMonthlyList.innerHTML = ""

  if (totals.length === 0) {
    const empty = document.createElement("li")
    empty.innerText = "Нет запланированных расходов"
    refs.plannedMonthlyList.appendChild(empty)
    plannedMonthlyChart.data.labels = []
    plannedMonthlyChart.data.datasets[0].data = []
    plannedMonthlyChart.update()
    return
  }

  const labels = []
  const values = []
  totals.forEach(([monthKey, amount]) => {
    labels.push(monthLabel(monthKey))
    values.push(amount)
    const li = document.createElement("li")
    li.innerText = monthLabel(monthKey) + ": " + money(amount)
    refs.plannedMonthlyList.appendChild(li)
  })

  plannedMonthlyChart.data.labels = labels
  plannedMonthlyChart.data.datasets[0].data = values
  plannedMonthlyChart.update()
}

function renderSummary() {
  const totals = computeTotals()
  refs.totalIncome.innerText = money(totals.totalIncome)
  refs.totalExpense.innerText = money(totals.totalExpense)
  refs.balance.innerText = money(totals.balance)
}

function createDeleteButton(onDelete) {
  const btn = document.createElement("button")
  btn.className = "danger"
  btn.type = "button"
  btn.innerText = "X"
  btn.addEventListener("click", onDelete)
  return btn
}

function colorByGroup(groupName) {
  const palette = [
    { bg: "#dbeafe", text: "#1e3a8a", border: "#93c5fd" },
    { bg: "#dcfce7", text: "#14532d", border: "#86efac" },
    { bg: "#fef3c7", text: "#78350f", border: "#fcd34d" },
    { bg: "#fce7f3", text: "#831843", border: "#f9a8d4" },
    { bg: "#ede9fe", text: "#4c1d95", border: "#c4b5fd" },
    { bg: "#cffafe", text: "#164e63", border: "#67e8f9" }
  ]
  const key = String(groupName || "Без группы")
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash)
  }
  return palette[Math.abs(hash) % palette.length]
}

function createGroupBadge(groupName) {
  const badge = document.createElement("span")
  badge.className = "group-badge"
  badge.innerText = groupName
  const color = colorByGroup(groupName)
  badge.style.backgroundColor = color.bg
  badge.style.color = color.text
  badge.style.borderColor = color.border
  return badge
}

function renderIncomes() {
  refs.incomeBody.innerHTML = ""
  state.incomes.forEach((item) => {
    const row = refs.incomeBody.insertRow()
    row.insertCell(0).innerText = item.name
    row.insertCell(1).innerText = money(item.amount)
    const action = row.insertCell(2)
    action.appendChild(createDeleteButton(() => {
      state.incomes = state.incomes.filter((it) => it.id !== item.id)
      saveState()
      renderAll()
    }))
  })
}

function renderExpenses() {
  refs.expenseBody.innerHTML = ""
  state.expenses.forEach((item) => {
    const row = refs.expenseBody.insertRow()
    const groupName = item.group || "Без группы"
    row.insertCell(0).innerText = item.name
    const groupCell = row.insertCell(1)
    groupCell.appendChild(createGroupBadge(groupName))
    row.insertCell(2).innerText = money(item.amount)
    const action = row.insertCell(3)
    action.appendChild(createDeleteButton(() => {
      state.expenses = state.expenses.filter((it) => it.id !== item.id)
      saveState()
      renderAll()
    }))
  })
}

function getExpenseGroupTotals() {
  return state.expenses.reduce((acc, item) => {
    const group = item.group && item.group.trim() ? item.group : "Без группы"
    acc[group] = (acc[group] || 0) + Number(item.amount)
    return acc
  }, {})
}

function renderExpenseGroups() {
  refs.expenseGroupBody.innerHTML = ""
  const grouped = getExpenseGroupTotals()
  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1])

  if (entries.length === 0) {
    const row = refs.expenseGroupBody.insertRow()
    const cell = row.insertCell(0)
    cell.colSpan = 2
    cell.innerText = "Нет расходов для группировки"
    return
  }

  entries.forEach(([groupName, total]) => {
    const row = refs.expenseGroupBody.insertRow()
    const groupCell = row.insertCell(0)
    groupCell.appendChild(createGroupBadge(groupName))
    row.insertCell(1).innerText = money(total)
  })
}

function renderPlans() {
  refs.planBody.innerHTML = ""
  const now = todayISO()
  state.plans
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((item) => {
      const row = refs.planBody.insertRow()
      if (item.date < now) row.classList.add("overdue")
      row.insertCell(0).innerText = item.name
      row.insertCell(1).innerText = money(item.amount)
      row.insertCell(2).innerText = item.date
      const action = row.insertCell(3)
      action.appendChild(createDeleteButton(() => {
        state.plans = state.plans.filter((it) => it.id !== item.id)
        saveState()
        renderAll()
      }))
    })
}

function renderAll() {
  renderIncomes()
  renderExpenses()
  renderExpenseGroups()
  renderPlans()
  renderPlannedMonthlySummary()
  renderSummary()
  updateChart()
}

function addIncome() {
  const name = refs.incomeName.value.trim()
  const amount = Number(refs.incomeAmount.value)
  if (!name || !Number.isFinite(amount) || amount <= 0) {
    alert("Введите корректные данные дохода")
    return
  }
  state.incomes.push({ id: uid(), name, amount })
  refs.incomeName.value = ""
  refs.incomeAmount.value = ""
  saveState()
  renderAll()
}

function addExpense() {
  const name = refs.expenseName.value.trim()
  const group = refs.expenseGroup.value.trim() || "Без группы"
  const amount = Number(refs.expenseAmount.value)
  if (!name || !Number.isFinite(amount) || amount <= 0) {
    alert("Введите корректные данные расхода")
    return
  }
  state.expenses.push({ id: uid(), name, group, amount })
  refs.expenseName.value = ""
  refs.expenseGroup.value = ""
  refs.expenseAmount.value = ""
  saveState()
  renderAll()
}

function addPlan() {
  const name = refs.planName.value.trim()
  const amount = Number(refs.planAmount.value)
  const date = refs.planDate.value
  if (!name || !Number.isFinite(amount) || amount <= 0 || !date) {
    alert("Введите корректные данные платежа")
    return
  }
  state.plans.push({ id: uid(), name, amount, date })
  refs.planName.value = ""
  refs.planAmount.value = ""
  refs.planDate.value = ""
  saveState()
  renderAll()
}

function clearAllData() {
  const accepted = confirm("Удалить все записи бюджета?")
  if (!accepted) return
  state = { incomes: [], expenses: [], plans: [] }
  saveState()
  renderAll()
}

function bindEvents() {
  document.getElementById("addIncomeBtn").addEventListener("click", addIncome)
  document.getElementById("addExpenseBtn").addEventListener("click", addExpense)
  document.getElementById("addPlanBtn").addEventListener("click", addPlan)
  document.getElementById("clearAllBtnTop").addEventListener("click", clearAllData)
  document.getElementById("clearAllBtnBottom").addEventListener("click", clearAllData)
  refs.themeToggleBtn.addEventListener("click", toggleTheme)
  ;[refs.incomeAmount, refs.expenseAmount, refs.planAmount].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        if (input === refs.incomeAmount) addIncome()
        if (input === refs.expenseAmount) addExpense()
        if (input === refs.planAmount) addPlan()
      }
    })
  })
}

function init() {
  createChart()
  createPlannedMonthlyChart()
  applyTheme(localStorage.getItem(THEME_KEY) || "light")
  loadState()
  bindEvents()
  renderAll()
}

init()

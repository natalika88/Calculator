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
  planType: document.getElementById("planType"),
  planPeriod: document.getElementById("planPeriod"),
  planPeriodWrap: document.getElementById("planPeriodWrap"),
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
  const start = new Date()
  const horizonStart = new Date(start.getFullYear(), start.getMonth(), start.getDate()) // сегодня, локально
  const horizonEnd = new Date(horizonStart)
  horizonEnd.setMonth(horizonEnd.getMonth() + 12) // +12 месяцев

  function parseISODate(dateStr) {
    const parts = String(dateStr || "").split("-")
    if (parts.length !== 3) return null
    const [y, m, d] = parts.map((x) => Number(x))
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
    return new Date(y, m - 1, d)
  }

  function daysInMonth(year, monthIndex) {
    // monthIndex: 0..11
    return new Date(year, monthIndex + 1, 0).getDate()
  }

  function toMonthKey(dt) {
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, "0")
    return `${y}-${m}`
  }

  function addDays(dt, days) {
    const x = new Date(dt)
    x.setDate(x.getDate() + days)
    return x
  }

  function addToAcc(acc, dt, amount) {
    const key = toMonthKey(dt)
    acc[key] = (acc[key] || 0) + Number(amount)
  }

  const monthly = {}

  state.plans.forEach((item) => {
    const startDate = parseISODate(item.date)
    if (!startDate) return

    const amount = Number(item.amount)
    if (!Number.isFinite(amount) || amount <= 0) return

    const type = item.type || "once" // backward compatibility
    const period = item.period || "month"

    if (type === "once") {
      if (startDate >= horizonStart && startDate <= horizonEnd) addToAcc(monthly, startDate, amount)
      return
    }

    if (type === "regular" && period === "month") {
      const day = startDate.getDate()
      const firstMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
      const lastMonth = new Date(horizonEnd.getFullYear(), horizonEnd.getMonth(), 1)

      for (
        let cursor = new Date(firstMonth);
        cursor <= lastMonth;
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      ) {
        const y = cursor.getFullYear()
        const mIndex = cursor.getMonth()
        const occDay = Math.min(day, daysInMonth(y, mIndex))
        const occ = new Date(y, mIndex, occDay)
        if (occ >= horizonStart && occ <= horizonEnd) addToAcc(monthly, occ, amount)
      }

      return
    }

    if (type === "regular" && period === "week") {
      // каждые 7 дней от стартовой даты
      const msDay = 24 * 60 * 60 * 1000
      let n = 0
      if (startDate < horizonStart) {
        n = Math.ceil((horizonStart - startDate) / (7 * msDay))
        n = Math.max(0, n)
      }

      let occ = addDays(startDate, n * 7)
      while (occ <= horizonEnd) {
        if (occ >= horizonStart) addToAcc(monthly, occ, amount)
        occ = addDays(occ, 7)
      }
      return
    }
  })

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

      const typeCell = row.insertCell(3)
      typeCell.innerText = item.type === "regular" ? "Регулярный" : "Разовый"

      const periodCell = row.insertCell(4)
      if (item.type === "regular") {
        periodCell.innerText = item.period === "week" ? "Неделя" : "Месяц"
      } else {
        periodCell.innerText = "—"
      }

      const action = row.insertCell(5)
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
  const type = refs.planType.value
  const period = refs.planPeriod.value
  const amount = Number(refs.planAmount.value)
  const date = refs.planDate.value
  if (!name || !Number.isFinite(amount) || amount <= 0 || !date) {
    alert("Введите корректные данные платежа")
    return
  }

  state.plans.push({
    id: uid(),
    name,
    amount,
    date,
    type,
    period: type === "regular" ? period : null
  })
  refs.planName.value = ""
  refs.planAmount.value = ""
  refs.planDate.value = ""

  // вернем дефолтные значения формы
  refs.planType.value = "once"
  refs.planPeriod.value = "month"
  syncPlanTypeUI()

  saveState()
  renderAll()
}

function syncPlanTypeUI() {
  const isRegular = refs.planType.value === "regular"
  if (isRegular) {
    refs.planPeriodWrap.classList.remove("hidden")
  } else {
    refs.planPeriodWrap.classList.add("hidden")
  }
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
  refs.planType.addEventListener("change", syncPlanTypeUI)
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
  syncPlanTypeUI()
  applyTheme(localStorage.getItem(THEME_KEY) || "light")
  loadState()
  bindEvents()
  renderAll()
}

init()

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content" @click.prevent="skipToContent">
      {{ t('nav.skipToContent') }}
    </a>

    <AppSidebar
      :items="navItems"
      :brand-name="t('nav.companyName')"
      :brand-tagline="t('nav.subtitle')"
      :nav-label="t('nav.mainNavigation')"
      :open="drawerOpen"
      @close="closeDrawer"
    />

    <div v-if="drawerOpen" class="sidebar-backdrop" @click="closeDrawer"></div>

    <div class="app-main">
      <header class="app-topbar">
        <div class="app-container">
          <button
            ref="menuButton"
            class="menu-button"
            type="button"
            aria-controls="app-sidebar"
            :aria-expanded="drawerOpen"
            :aria-label="t('nav.openMenu')"
            @click="drawerOpen = true"
          >
            <svg class="shell-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path v-for="d in navIcons.menu" :key="d" :d="d" />
            </svg>
          </button>
          <div class="topbar-actions">
            <LanguageSwitcher />
            <ProfileMenu
              @show-profile-details="showProfileDetails = true"
              @show-tasks="showTasks = true"
            />
          </div>
        </div>
      </header>
      <FilterBar />
      <main id="main-content" class="app-content" tabindex="-1">
        <div class="app-container">
          <router-view />
        </div>
      </main>
    </div>
  </div>

  <!-- Modals sit after the grid so they never take a grid cell. -->
  <ProfileDetailsModal
    :is-open="showProfileDetails"
    @close="showProfileDetails = false"
  />

  <TasksModal
    :is-open="showTasks"
    :tasks="tasks"
    @close="showTasks = false"
    @add-task="addTask"
    @delete-task="deleteTask"
    @toggle-task="toggleTask"
  />
</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { api } from './api'
import { useAuth } from './composables/useAuth'
import { useI18n } from './composables/useI18n'
import FilterBar from './components/FilterBar.vue'
import ProfileMenu from './components/ProfileMenu.vue'
import ProfileDetailsModal from './components/ProfileDetailsModal.vue'
import TasksModal from './components/TasksModal.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import AppSidebar from './components/AppSidebar.vue'
import { navIcons } from './components/navIcons'

export default {
  name: 'App',
  components: {
    FilterBar,
    ProfileMenu,
    ProfileDetailsModal,
    TasksModal,
    LanguageSwitcher,
    AppSidebar
  },
  setup() {
    const { currentUser } = useAuth()
    const { t } = useI18n()
    const showProfileDetails = ref(false)
    const showTasks = ref(false)
    const apiTasks = ref([])

    // Merge mock tasks from currentUser with API tasks
    const tasks = computed(() => {
      return [...currentUser.value.tasks, ...apiTasks.value]
    })

    const loadTasks = async () => {
      try {
        apiTasks.value = await api.getTasks()
      } catch (err) {
        console.error('Failed to load tasks:', err)
      }
    }

    const addTask = async (taskData) => {
      try {
        const newTask = await api.createTask(taskData)
        // Add new task to the beginning of the array
        apiTasks.value.unshift(newTask)
      } catch (err) {
        console.error('Failed to add task:', err)
      }
    }

    const deleteTask = async (taskId) => {
      try {
        // Check if it's a mock task (from currentUser)
        const isMockTask = currentUser.value.tasks.some(t => t.id === taskId)

        if (isMockTask) {
          // Remove from mock tasks
          const index = currentUser.value.tasks.findIndex(t => t.id === taskId)
          if (index !== -1) {
            currentUser.value.tasks.splice(index, 1)
          }
        } else {
          // Remove from API tasks
          await api.deleteTask(taskId)
          apiTasks.value = apiTasks.value.filter(t => t.id !== taskId)
        }
      } catch (err) {
        console.error('Failed to delete task:', err)
      }
    }

    const toggleTask = async (taskId) => {
      try {
        // Check if it's a mock task (from currentUser)
        const mockTask = currentUser.value.tasks.find(t => t.id === taskId)

        if (mockTask) {
          // Toggle mock task status
          mockTask.status = mockTask.status === 'pending' ? 'completed' : 'pending'
        } else {
          // Toggle API task
          const updatedTask = await api.toggleTask(taskId)
          const index = apiTasks.value.findIndex(t => t.id === taskId)
          if (index !== -1) {
            apiTasks.value[index] = updatedTask
          }
        }
      } catch (err) {
        console.error('Failed to toggle task:', err)
      }
    }

    // Built as a computed so labels follow language changes.
    const navItems = computed(() => [
      { to: '/', label: t('nav.overview'), icon: navIcons.dashboard },
      { to: '/inventory', label: t('nav.inventory'), icon: navIcons.box },
      { to: '/orders', label: t('nav.orders'), icon: navIcons.clipboard },
      { to: '/spending', label: t('nav.finance'), icon: navIcons.card },
      { to: '/demand', label: t('nav.demandForecast'), icon: navIcons.trending },
      { to: '/reports', label: t('nav.reports'), icon: navIcons.bars }
    ])

    // Drawer state: only used at 768px and below, where the sidebar is off-canvas.
    const drawerOpen = ref(false)
    const menuButton = ref(null)

    const closeDrawer = () => {
      if (!drawerOpen.value) return
      drawerOpen.value = false
      nextTick(() => menuButton.value?.focus()) // return focus to where the user was
    }

    // Listen on the document: after clicking the menu button, focus is on the
    // button, outside the sidebar, so a listener on the sidebar would not fire.
    const onKeydown = (event) => {
      if (event.key === 'Escape') closeDrawer()
    }
    onMounted(() => document.addEventListener('keydown', onKeydown))
    onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

    // Move focus into the drawer when it opens, so the next Tab is a nav link.
    watch(drawerOpen, async (open) => {
      if (!open) return
      await nextTick()
      document.querySelector('#app-sidebar .sidebar-link')?.focus()
    })

    // Focus <main> without following the anchor. Following it would scroll the
    // page heading underneath the sticky bars, and would change the URL, which
    // breaks hash-mode routing.
    const skipToContent = () => {
      document.getElementById('main-content')?.focus({ preventScroll: true })
    }

    onMounted(loadTasks)

    return {
      t,
      navItems,
      navIcons,
      drawerOpen,
      menuButton,
      closeDrawer,
      skipToContent,
      showProfileDetails,
      showTasks,
      tasks,
      addTask,
      deleteTask,
      toggleTask
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* On body, not on the shell, so that teleported modals inherit it too.
   Inter was never loaded, so --font-sans keeps the system stack the app was
   already rendering in. */
body {
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  min-height: 100vh;
}

.app-main {
  min-width: 0; /* lets wide tables scroll inside their own container */
  display: flex;
  flex-direction: column;
}

/* Shared by the top bar, filter bar and page content so their edges align. */
.app-container {
  width: 100%;
  max-width: var(--content-max-width);
  margin-inline: auto;
  padding-inline: var(--content-padding-x);
}

.app-topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-topbar);
  height: var(--topbar-height);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.app-topbar > .app-container {
  height: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-content {
  flex: 1;
  padding-block: var(--content-padding-y);
}

.menu-button {
  display: none; /* shown in drawer mode */
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
}

.shell-icon {
  width: 1.25rem;
  height: 1.25rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Hidden by default so it never takes a grid cell on wide screens. */
.sidebar-backdrop {
  display: none;
}

.skip-link {
  position: absolute;
  left: var(--space-2);
  top: var(--space-2);
  z-index: var(--z-toast);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  transform: translateY(-200%);
}

.skip-link:focus {
  transform: none;
}

:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* The skip link focuses <main>. Without this the whole page gets a ring. */
.app-content:focus-visible {
  outline: none;
}

/* Rail: sidebar collapses to icons only. */
@media (max-width: 1024px) {
  .app-shell {
    grid-template-columns: var(--sidebar-width-rail) minmax(0, 1fr);
  }
}

/* Drawer: sidebar is off-canvas (see AppSidebar), opened by the menu button. */
@media (max-width: 768px) {
  .app-shell {
    grid-template-columns: minmax(0, 1fr);
  }
  .menu-button {
    display: inline-flex;
  }
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: var(--z-backdrop);
    background: rgb(15 23 42 / 0.4);
  }
}

.page-header {
  margin-bottom: var(--space-6);
}

.page-header h2 {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--color-text);
  margin-bottom: var(--space-1);
  letter-spacing: -0.025em;
}

.page-header p {
  color: var(--color-text-muted);
  font-size: var(--text-base);
}

/* Minimum lowered from 280px: with the sidebar the content area at 1440px is
   1128px, and four cards with 20px gaps need a minimum of 267px or less to
   stay on one row. */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-5);
  margin-bottom: var(--space-6);
}

.stat-card {
  background: var(--color-surface);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-xs);
  transition: all var(--duration-base) var(--ease-standard);
}

.stat-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-md);
}

.stat-label {
  color: var(--color-text-muted);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-2);
}

.stat-value {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  color: var(--color-text);
  letter-spacing: -0.025em;
}

.stat-card.warning .stat-value {
  color: var(--color-warning);
}

.stat-card.success .stat-value {
  color: var(--color-success);
}

.stat-card.danger .stat-value {
  color: var(--color-danger);
}

.stat-card.info .stat-value {
  color: var(--color-info);
}

.card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-xs);
  margin-bottom: var(--space-5);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.card-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--color-text);
  letter-spacing: -0.025em;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  font-weight: var(--font-semibold);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

td {
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--color-surface-subtle);
  color: var(--color-text);
  font-size: var(--text-base);
}

tbody tr {
  transition: background-color var(--duration-fast) var(--ease-standard);
}

tbody tr:hover {
  background: var(--color-bg);
}

.badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.badge.success {
  background: var(--color-success-subtle);
  color: var(--color-success-text);
}

.badge.warning {
  background: var(--color-warning-subtle);
  color: var(--color-warning-text);
}

.badge.danger {
  background: var(--color-danger-subtle);
  color: var(--color-danger-text);
}

.badge.info {
  background: var(--color-info-subtle);
  color: var(--color-info-text);
}

.badge.increasing {
  background: var(--color-success-subtle);
  color: var(--color-success-text);
}

.badge.decreasing {
  background: var(--color-danger-subtle);
  color: var(--color-danger-text);
}

.badge.stable {
  background: var(--color-accent-subtle);
  color: var(--color-accent-text);
}

.badge.high {
  background: var(--color-danger-subtle);
  color: var(--color-danger-text);
}

.badge.medium {
  background: var(--color-warning-subtle);
  color: var(--color-warning-text);
}

.badge.low {
  background: var(--color-info-subtle);
  color: var(--color-info-text);
}

.loading {
  text-align: center;
  padding: var(--space-12);
  color: var(--color-text-muted);
  font-size: var(--text-base);
}

/* No token for the faint red wash this used, so tint the surface
   with the danger-subtle token instead. */
.error {
  background: color-mix(in srgb, var(--color-danger-subtle) 30%, var(--color-surface));
  border: 1px solid var(--color-danger-subtle);
  color: var(--color-danger-text);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  margin: var(--space-4) 0;
  font-size: var(--text-base);
}
</style>

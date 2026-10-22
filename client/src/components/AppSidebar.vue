<template>
  <aside id="app-sidebar" class="app-sidebar" :class="{ 'is-open': open }">
    <div class="sidebar-brand">
      <span class="sidebar-brand-mark" aria-hidden="true">{{ brandName.charAt(0) }}</span>
      <span class="sidebar-brand-text">
        <span class="sidebar-brand-name">{{ brandName }}</span>
        <span v-if="brandTagline" class="sidebar-brand-tagline">{{ brandTagline }}</span>
      </span>
    </div>

    <nav class="sidebar-nav" :aria-label="navLabel">
      <ul class="sidebar-list">
        <li v-for="item in items" :key="item.to">
          <RouterLink :to="item.to" class="sidebar-link" :title="item.label" @click="$emit('close')">
            <svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path v-for="d in item.icon" :key="d" :d="d" />
            </svg>
            <span class="sidebar-label">{{ item.label }}</span>
          </RouterLink>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script>
export default {
  name: 'AppSidebar',
  props: {
    items: { type: Array, required: true }, // [{ to, label, icon: string[] }]
    brandName: { type: String, required: true },
    brandTagline: { type: String, default: '' },
    navLabel: { type: String, default: 'Main' },
    open: { type: Boolean, default: false } // drawer mode only
  },
  emits: ['close']
}
</script>

<style scoped>
.app-sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  z-index: var(--z-sidebar);
}

.sidebar-brand {
  position: relative; /* containing block for the hidden text in rail mode */
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: var(--topbar-height); /* lines up with the top bar's bottom border */
  padding-inline: var(--space-4);
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}

.sidebar-brand-mark {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: var(--font-bold);
}

.sidebar-brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: var(--leading-tight);
}

.sidebar-brand-name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--sidebar-fg-strong);
}

.sidebar-brand-tagline {
  font-size: var(--text-xs);
  color: var(--sidebar-fg);
}

.sidebar-brand-name,
.sidebar-brand-tagline {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto; /* only the link list scrolls, never the whole sidebar */
  padding: var(--space-3);
}

.sidebar-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sidebar-link {
  position: relative; /* containing block for the hidden label in rail mode */
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--sidebar-fg);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  text-decoration: none;
  transition: background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}

.sidebar-link:hover {
  background: var(--sidebar-item-hover-bg);
  color: var(--sidebar-fg-strong);
}

/* RouterLink sets aria-current="page" on the exact active route. */
.sidebar-link[aria-current='page'] {
  background: var(--sidebar-item-active-bg);
  color: var(--sidebar-item-active-fg);
}

.sidebar-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sidebar-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Keep the two blocks below in this order: the drawer block must come last so
   that it overrides the rail block. */
@media (max-width: 1024px) {
  /* Rail: hide labels visually but keep them for screen readers. */
  .sidebar-label,
  .sidebar-brand-text {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .sidebar-brand,
  .sidebar-link {
    justify-content: center;
    padding-inline: 0;
  }
}

@media (max-width: 768px) {
  /* Drawer: full sidebar again, off-canvas until opened. */
  .app-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: var(--sidebar-width);
    z-index: var(--z-drawer);
    box-shadow: var(--shadow-lg);
    transform: translateX(-100%);
    visibility: hidden; /* keeps closed links out of the tab order */
    transition: transform var(--duration-base) var(--ease-standard), visibility 0s linear var(--duration-base);
  }
  .app-sidebar.is-open {
    transform: none;
    visibility: visible;
    transition-delay: 0s;
  }
  /* Undo every declaration of the rail block. */
  .sidebar-label,
  .sidebar-brand-text {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    overflow: visible;
    clip-path: none;
    white-space: normal;
  }
  .sidebar-label {
    overflow: hidden; /* restore the base ellipsis */
    white-space: nowrap;
  }
  /* Restore each element's own base padding: they differ. */
  .sidebar-brand {
    justify-content: flex-start;
    padding-inline: var(--space-4);
  }
  .sidebar-link {
    justify-content: flex-start;
    padding-inline: var(--space-3);
  }
}
</style>

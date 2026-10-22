#!/usr/bin/env node
/**
 * vue-saas-redesign audit
 *
 * Read-only survey of a Vue 3 source directory. Reports what a top-nav to
 * sidebar redesign has to detect and change, and prints a scorecard that the
 * skill re-checks after each phase.
 *
 * Usage: node audit.mjs <vue-src-dir> [--json] [--nav-px=<n>]
 *
 *   --json         Print the full report as JSON.
 *   --nav-px=<n>   Height of the OLD nav in px, as printed by the first run.
 *                  Pass it on every re-run. Once the old nav rules are
 *                  deleted the script cannot rediscover that height, and
 *                  leftover offsets tied to it would go unnoticed.
 *
 * Zero dependencies. Never writes to disk. Never executes project code.
 */
import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const target = argv.find((a) => !a.startsWith('--'))
const navPxArg = (argv.find((a) => a.startsWith('--nav-px'))?.split('=')[1] ?? '')
  .split(',')
  .map(Number)
  .filter((n) => Number.isFinite(n) && n > 0)
// A known old nav height means this is a re-run after the first audit.
const isRerun = navPxArg.length > 0

function fail(message) {
  console.error(`audit: ${message}`)
  process.exit(2)
}

const USAGE = 'usage: node audit.mjs <vue-src-dir> [--json] [--nav-px=<n>]'
// A mistyped option must not pass silently: a re-run without a working
// --nav-px would report gates as passing when they were never checked.
const unknown = argv.find((a) => a.startsWith('--') && a !== '--json' && !a.startsWith('--nav-px='))
if (unknown) fail(`unknown option ${unknown}\n${USAGE}`)
if (argv.some((a) => a.startsWith('--nav-px')) && navPxArg.length === 0) {
  fail(`--nav-px needs a height in px, for example --nav-px=70\n${USAGE}`)
}
if (!target) fail(USAGE)
const srcDir = path.resolve(target)
if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
  fail(`not a directory: ${srcDir}`)
}

// ---------------------------------------------------------------- helpers

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage'])
const SOURCE_EXT = /\.(vue|js|mjs|ts|jsx|tsx|css|scss|sass|less)$/
// Matched against paths relative to the project, never absolute ones, so a
// parent folder that happens to be called "pages" or "lang" changes nothing.
const LOCALE_DIR = /(^|[\\/])(locales?|i18n|lang|translations|messages)[\\/]/
const VIEW_DIR = /(^|[\\/])(views|pages)[\\/]/
const MAX_FILE_BYTES = 2 * 1024 * 1024
const skipped = []

function walk(dir, out = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    skipped.push(`${dir} (${error.code ?? 'unreadable'})`)
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && !SKIP_DIRS.has(entry.name)) walk(full, out)
    } else if (SOURCE_EXT.test(entry.name)) {
      out.push(full)
    } else if (entry.name.endsWith('.json') && LOCALE_DIR.test(path.relative(srcDir, full))) {
      // JSON is only read where it can hold translations.
      out.push(full)
    }
  }
  return out
}

function findProjectRoot(start) {
  let dir = start
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir
    const up = path.dirname(dir)
    if (up === dir) break
    dir = up
  }
  return null
}

const projectRoot = findProjectRoot(srcDir)
const rel = (p) => path.relative(projectRoot ?? srcDir, p) || '.'

function lineAt(text, index) {
  let line = 1
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++
  }
  return line
}

// Comments are blanked rather than removed so that line numbers stay correct.
const blank = (s) => s.replace(/[^\n]/g, ' ')
const stripCssComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, blank)

function toPx(value) {
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(String(value).trim())
  if (!m) return null
  const n = parseFloat(m[1])
  if (m[2] === 'rem' || m[2] === 'em') return n * 16
  if (m[2] === 'px' || n === 0) return n
  return null
}

const toPascal = (name) =>
  name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase())

function countBy(items, keyFn) {
  const map = new Map()
  for (const item of items) {
    const key = keyFn(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

// ---------------------------------------------------------------- parsing

function parseFile(file) {
  let src
  try {
    if (fs.statSync(file).size > MAX_FILE_BYTES) {
      skipped.push(`${rel(file)} (larger than 2 MB)`)
      return null
    }
    src = fs.readFileSync(file, 'utf8')
  } catch (error) {
    // Broken symlink, permissions, or a file removed mid-run.
    skipped.push(`${rel(file)} (${error.code ?? 'unreadable'})`)
    return null
  }
  const ext = path.extname(file)
  const parsed = { file, rel: rel(file), ext, src, template: null, scripts: [], styles: [] }

  if (ext === '.vue') {
    // Outermost template: first opening tag to last closing tag, so nested
    // <template v-if> blocks stay inside the content.
    const open = src.match(/<template(\s[^>]*)?>/)
    const close = src.lastIndexOf('</template>')
    if (open && close > open.index) {
      const start = open.index + open[0].length
      parsed.template = { content: src.slice(start, close), offset: start }
    }
    for (const m of src.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
      parsed.scripts.push({
        content: m[2],
        offset: m.index + m[0].indexOf('>') + 1,
        setup: /\bsetup\b/.test(m[1] ?? ''),
      })
    }
    for (const m of src.matchAll(/<style(\s[^>]*)?>([\s\S]*?)<\/style>/g)) {
      parsed.styles.push({
        content: stripCssComments(m[2]),
        offset: m.index + m[0].indexOf('>') + 1,
        scoped: /\b(scoped|module)\b/.test(m[1] ?? ''),
      })
    }
  } else if (/\.(css|scss|sass|less)$/.test(ext)) {
    parsed.styles.push({ content: stripCssComments(src), offset: 0, scoped: false })
  } else if (/\.(js|mjs|ts|jsx|tsx)$/.test(ext)) {
    parsed.scripts.push({ content: src, offset: 0, setup: false })
  }
  return parsed
}

function rulesOf(parsed) {
  const rules = []
  for (const style of parsed.styles) {
    // Matches innermost blocks only, so rules nested in @media are found and
    // the @media wrapper itself is skipped.
    for (const m of style.content.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const tail = m[1].split(';').pop()
      const selector = tail.trim().replace(/\s+/g, ' ')
      if (!selector) continue
      const selectorStart = m.index + m[1].length - tail.trimStart().length
      const decls = []
      let cursor = m.index + m[1].length + 1
      for (const part of m[2].split(';')) {
        const colon = part.indexOf(':')
        if (colon > 0) {
          const lead = part.length - part.trimStart().length
          decls.push({
            prop: part.slice(0, colon).trim().toLowerCase(),
            value: part.slice(colon + 1).trim().replace(/\s+/g, ' '),
            line: lineAt(parsed.src, style.offset + cursor + lead),
          })
        }
        cursor += part.length + 1
      }
      rules.push({
        rel: parsed.rel,
        selector,
        line: lineAt(parsed.src, style.offset + selectorStart),
        scoped: style.scoped,
        decls,
      })
    }
  }
  return rules
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Finds `key` as a direct property of the object literal that starts at
// `start` (the index of its opening brace). Returns the index of the value's
// opening brace, -1 for a non-object value, or null when the key is missing.
// Walks braces by hand so the locale file never has to be executed.
function findKey(text, start, key) {
  const keyPattern = new RegExp(`^(['"\`]?)${escapeRegExp(key)}\\1\\s*:`)
  // Room for the key, its quotes, and generous whitespace before the colon.
  const window = key.length + 40
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      if (depth === 1 && keyPattern.test(text.slice(i, i + window))) {
        // quoted key: fall through to the match below
      } else {
        i = skipString(text, i)
        continue
      }
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    // Skip block comments whole: an apostrophe or brace inside one would
    // otherwise throw off string and depth tracking for the rest of the file.
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end < 0 ? text.length : end + 1
      continue
    }
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) return null
    } else if (depth === 1 && /[\w'"`$]/.test(ch) && /[{,\s]/.test(text[i - 1] ?? '{')) {
      const m = keyPattern.exec(text.slice(i, i + window))
      if (m) {
        let j = i + m[0].length
        while (/\s/.test(text[j])) j++
        return text[j] === '{' ? j : -1
      }
      // Not our key: skip the identifier so its characters are not re-tested.
      while (i + 1 < text.length && /[\w$]/.test(text[i + 1])) i++
    }
  }
  return null
}

function skipString(text, i) {
  const quote = text[i]
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') j++
    else if (text[j] === quote) return j
  }
  return text.length
}

// Limitation: expects one language per file. A single file holding every
// language under top-level keys ({ en: {...}, ja: {...} }) reports keys missing.
function hasKeyPath(text, dotted) {
  // Start at the exported object, not at the first brace in the file, which
  // may belong to an import statement.
  const exported = /(?:export\s+default\s*|module\.exports\s*=\s*)\{/.exec(text) ?? /^\s*\{/.exec(text) ?? /=\s*\{/.exec(text)
  let at = exported ? exported.index + exported[0].length - 1 : text.indexOf('{')
  if (at < 0) return false
  const segments = dotted.split('.')
  for (const [index, segment] of segments.entries()) {
    const next = findKey(text, at, segment)
    if (next === null) return false
    // The value is not an object literal (an imported object or a spread).
    // The rest of the path cannot be checked, so do not report it missing.
    if (next === -1) return true
    at = next
    if (index === segments.length - 1) return true
  }
  return true
}

// ---------------------------------------------------------------- collect

const files = walk(srcDir).map(parseFile).filter(Boolean)
const vueFiles = files.filter((f) => f.ext === '.vue')
const rules = files.flatMap(rulesOf)
const decls = rules.flatMap((r) => r.decls.map((d) => ({ ...d, rel: r.rel, selector: r.selector, scoped: r.scoped })))

const report = { source: rel(srcDir), project: null, stop: [], warnings: [] }

// --- project and stop conditions
let pkg = null
let pkgInvalid = false
if (projectRoot) {
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
  } catch {
    pkgInvalid = true
  }
}
if (skipped.length) report.warnings.push(`skipped ${skipped.length} unreadable or oversized entries: ${skipped.slice(0, 5).join(', ')}`)
const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
const depNames = Object.keys(deps)
const hasDep = (pattern) => depNames.filter((d) => pattern.test(d))

report.project = {
  root: projectRoot ? path.basename(projectRoot) : null,
  vue: deps.vue ?? null,
  typescript: 'typescript' in deps,
  iconLibraries: hasDep(/^(lucide-vue|@heroicons\/vue|@fortawesome\/|@iconify\/|@mdi\/|vue-feather|@tabler\/icons)/),
}

if (pkgInvalid) report.stop.push(`${rel(path.join(projectRoot, 'package.json'))} is not valid JSON`)
else if (!pkg) report.stop.push('no package.json found at or above the source directory')
else if (!deps.vue) report.stop.push('vue is not a dependency of this package')
else if (/^[\^~>=\s]*2\./.test(deps.vue)) report.stop.push(`Vue 2 project (vue ${deps.vue})`)
const nuxt = hasDep(/^nuxt/)
if (nuxt.length) report.stop.push(`Nuxt project (${nuxt.join(', ')}): layouts and routing work differently`)
const libs = hasDep(/^(vuetify|element-plus|primevue|quasar|naive-ui|ant-design-vue|bootstrap-vue|bootstrap-vue-next|buefy|@nuxt\/ui|vuestic-ui|@ionic\/vue)$/)
if (libs.length) report.stop.push(`component library in use (${libs.join(', ')}): restyle through its theme, not this skill`)
const cssFrameworks = hasDep(/^(tailwindcss|unocss|windicss|bootstrap|bulma)$|^@unocss\//)
if (cssFrameworks.length) report.stop.push(`utility or CSS framework in use (${cssFrameworks.join(', ')}): tokens belong in its config`)
if (vueFiles.length === 0) report.stop.push('no .vue files found under the source directory')

// --- component API style
function apiStyle(f) {
  if (f.scripts.some((s) => s.setup)) return 'script-setup'
  const code = f.scripts.map((s) => s.content).join('\n')
  if (/\bsetup\s*\(/.test(code)) return 'setup-function'
  if (/\b(data\s*\(\s*\)|methods\s*:|computed\s*:|props\s*:|emits\s*:)/.test(code)) return 'options'
  return f.scripts.length ? 'other' : 'none'
}
const styleOf = new Map(vueFiles.map((f) => [f.rel, apiStyle(f)]))
report.apiStyles = Object.fromEntries(countBy([...styleOf.values()], (s) => s))

// --- shell, nav and router
// Attributes are matched as quoted strings or single characters, so a ">"
// inside an attribute value (an arrow function, a comparison) does not end
// the tag early. Self-closing links are matched too.
const LINK = /<(router-link|RouterLink)\b((?:"[^"]*"|'[^']*'|[^>"'])*?)(?:\/>|>([\s\S]*?)<\/\1>)/g
const withTemplate = vueFiles.filter((f) => f.template)
const linkCount = (f) => [...f.template.content.matchAll(LINK)].length
const shellFiles = withTemplate.filter((f) => /<(router-view|RouterView)\b/.test(f.template.content))
const isShell = (f) => shellFiles.includes(f)
// A nav file has several links, or one link (usually in a v-for) inside a
// landmark element. Page views are left out: two "back" links in a view do
// not make it the app's navigation.
const navFiles = withTemplate.filter((f) => {
  const count = linkCount(f)
  if (count === 0) return false
  if (VIEW_DIR.test(f.rel) && !isShell(f)) return false
  return count >= 2 || /<(nav|aside|header)\b/.test(f.template.content)
})
const shellSet = new Set([...shellFiles, ...navFiles].map((f) => f.rel))

const routerFile = files.find((f) => f.scripts.some((s) => /\bcreateRouter\s*\(/.test(s.content)))
const routes = routerFile
  ? [...routerFile.src.matchAll(/\bpath\s*:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1])
  : []

// Files that set up the i18n library hold no messages, so they are left out.
const localeFiles = files.filter(
  (f) => LOCALE_DIR.test(f.rel) && /\.(js|ts|mjs|json)$/.test(f.ext) && !/\bcreateI18n\s*\(/.test(f.src),
)

const navLinks = []
for (const f of navFiles) {
  for (const m of f.template.content.matchAll(LINK)) {
    const to = /(?:^|\s):?to=(["'])(.*?)\1/.exec(m[2])?.[2] ?? null
    const inner = (m[3] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const key = /\$?\bt\(\s*['"]([^'"]+)['"]/.exec(inner)?.[1] ?? null
    const link = { rel: f.rel, line: lineAt(f.src, f.template.offset + m.index), to, label: inner }
    if (key) {
      link.kind = 'i18n'
      link.key = key
      link.missingIn = localeFiles.filter((l) => !hasKeyPath(l.src, key)).map((l) => l.rel)
    } else if (inner && !inner.includes('{{')) {
      link.kind = 'hardcoded'
    } else {
      link.kind = inner ? 'dynamic' : 'icon-only'
    }
    navLinks.push(link)
  }
}

// Every translation key the shell files use, in template or script. After the
// redesign the nav labels are built in script, so checking only the link
// markup would find nothing and report no missing keys.
const shellKeys = new Map()
for (const f of files.filter((x) => shellSet.has(x.rel))) {
  const text = [f.template?.content ?? '', ...f.scripts.map((s) => s.content)].join('\n')
  for (const m of text.matchAll(/(?<![\w.])\$?t\(\s*['"]([\w-]+(?:\.[\w-]+)+)['"]/g)) {
    if (!shellKeys.has(m[1])) shellKeys.set(m[1], f.rel)
  }
}
const missingKeys = [...shellKeys.entries()]
  .map(([key, usedIn]) => ({ key, usedIn, missingIn: localeFiles.filter((l) => !hasKeyPath(l.src, key)).map((l) => l.rel) }))
  .filter((k) => k.missingIn.length)

const usesI18n = shellKeys.size > 0 || navLinks.some((l) => l.kind === 'i18n')
if (usesI18n && localeFiles.length === 0) {
  report.warnings.push('the shell uses t() but no locale files were found: missing keys cannot be checked')
}
report.shell = {
  shellFiles: shellFiles.map((f) => ({ rel: f.rel, api: styleOf.get(f.rel) })),
  navFiles: navFiles.map((f) => ({
    rel: f.rel,
    api: styleOf.get(f.rel),
    links: linkCount(f),
    manualActiveClass: /\$route\.(path|name)\s*===?/.test(f.template.content),
  })),
  // Hash-mode routing matters for the skip link: an in-page anchor would
  // overwrite the route.
  router: routerFile ? { rel: routerFile.rel, routes, hashMode: /createWebHashHistory/.test(routerFile.src) } : null,
  navLinks,
  // A hardcoded label only matters when the rest of the nav is translated.
  hardcodedLabels: usesI18n ? navLinks.filter((l) => l.kind === 'hardcoded') : [],
  missingLocaleKeys: missingKeys,
  keysChecked: shellKeys.size,
  localeFiles: localeFiles.map((l) => l.rel),
}

// --- components mounted in the header, and siblings rendered before <main>
const SKIP_TAGS = new Set(['RouterLink', 'RouterView', 'Transition', 'TransitionGroup', 'KeepAlive', 'Teleport', 'Suspense', 'Component'])
function componentsIn(markup) {
  const found = new Set()
  for (const m of markup.matchAll(/<([A-Z][A-Za-z0-9]+|[a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/g)) {
    const name = toPascal(m[1])
    if (!SKIP_TAGS.has(name)) found.add(name)
  }
  return [...found]
}
const fileOfComponent = (name) => vueFiles.find((f) => path.basename(f.file, '.vue') === name)?.rel ?? null

const headerMounted = new Set()
for (const f of navFiles) {
  const t = f.template.content
  const open = t.search(/<(header|nav)\b/)
  const close = Math.max(t.lastIndexOf('</header>'), t.lastIndexOf('</nav>'))
  if (open >= 0 && close > open) componentsIn(t.slice(open, close)).forEach((c) => headerMounted.add(c))
}

const siblingsBeforeMain = []
for (const f of shellFiles) {
  const t = f.template.content
  let mainAt = t.search(/<main\b/)
  if (mainAt < 0) mainAt = t.search(/<(router-view|RouterView)\b/)
  // When the header is its own component there is no closing tag to anchor
  // on, so scan from the top and leave out the nav component itself.
  const headerEnd = Math.max(t.lastIndexOf('</header>', mainAt), t.lastIndexOf('</nav>', mainAt), 0)
  if (mainAt > 0) {
    for (const name of componentsIn(t.slice(headerEnd, mainAt))) {
      const file = fileOfComponent(name)
      if (navFiles.some((n) => n.rel === file)) continue
      siblingsBeforeMain.push({ component: name, rel: file, shell: f.rel })
    }
  }
}

// --- nav height and everything tied to it
const NAV_SELECTOR = /(nav|header|top-?bar|app-?bar|toolbar)/i
const navHeights = []
for (const r of rules) {
  if (!shellSet.has(r.rel) || !NAV_SELECTOR.test(r.selector)) continue
  for (const d of r.decls) {
    const px = d.prop === 'height' ? toPx(d.value) : null
    // 40 to 120px rules out underline indicators and full-height panels.
    if (px !== null && px >= 40 && px <= 120) navHeights.push({ px, value: d.value, selector: r.selector, rel: r.rel, line: d.line })
  }
}
const navPx = new Set([...navHeights.map((h) => h.px), ...navPxArg])
const OFFSET_PROPS = new Set(['top', 'padding-top', 'margin-top', 'scroll-margin-top', 'scroll-padding-top', 'inset-block-start'])
const coupledOffsets = decls.filter((d) => {
  if (navPx.size === 0) return false
  if (OFFSET_PROPS.has(d.prop) && navPx.has(toPx(d.value))) return true
  // calc(100vh - 70px) style expressions that subtract the nav height
  return /calc\(/.test(d.value) && [...navPx].some((px) => new RegExp(`(^|[^\\d.])${px}px`).test(d.value))
})

const pick = (r, prop) => r.decls.find((d) => d.prop === prop)?.value ?? null
const positioned = rules
  .filter((r) => /^(sticky|fixed)$/.test(pick(r, 'position') ?? ''))
  .map((r) => ({ rel: r.rel, line: r.line, selector: r.selector, position: pick(r, 'position'), top: pick(r, 'top'), zIndex: pick(r, 'z-index') }))

const dropdowns = rules
  .filter((r) => pick(r, 'position') === 'absolute' && /^(calc\(\s*100%|100%)/.test(pick(r, 'top') ?? ''))
  .map((r) => ({
    rel: r.rel,
    line: r.line,
    selector: r.selector,
    align: pick(r, 'right') !== null ? 'right' : pick(r, 'left') !== null ? 'left' : 'unset',
    minWidth: pick(r, 'min-width'),
    inHeader: headerMounted.has(path.basename(r.rel, '.vue')),
  }))

const zIndex = countBy(decls.filter((d) => d.prop === 'z-index'), (d) => d.value)
  .map(([value, count]) => ({ value, count, where: decls.filter((d) => d.prop === 'z-index' && d.value === value).map((d) => `${d.rel}:${d.line}`) }))
  .sort((a, b) => (parseFloat(a.value) || 0) - (parseFloat(b.value) || 0))

// Only the shell and the bars it renders count as page-width containers. A
// wide modal or chart in a view is not one.
const shellRelated = new Set([
  ...shellSet,
  ...siblingsBeforeMain.map((s) => s.rel),
  ...[...headerMounted].map(fileOfComponent),
])
const widthDecls = decls.filter((d) => d.prop === 'max-width' && (toPx(d.value) ?? 0) >= 960 && shellRelated.has(d.rel))
const pageWidths = countBy(widthDecls, (d) => d.value)
  .map(([value, count]) => ({ value, count, where: widthDecls.filter((d) => d.value === value).map((d) => `${d.rel}:${d.line}`) }))

const existingSidebar = [
  ...new Set([
    ...vueFiles.filter((f) => /side-?(bar|nav)|drawer/i.test(path.basename(f.file))).map((f) => f.rel),
    ...withTemplate.filter((f) => /<aside\b/.test(f.template.content)).map((f) => f.rel),
  ]),
]
// On a re-run the sidebar found here is the one the redesign just added.
if (existingSidebar.length && !isRerun) {
  report.stop.push(`a sidebar may already exist (${existingSidebar.join(', ')}): confirm before replacing it`)
}

report.layout = {
  navHeights,
  coupledOffsets: coupledOffsets.map((d) => ({ rel: d.rel, line: d.line, selector: d.selector, decl: `${d.prop}: ${d.value}` })),
  positioned,
  siblingsBeforeMain,
  headerMounted: [...headerMounted].map((name) => ({ component: name, rel: fileOfComponent(name) })),
  dropdowns,
  zIndex,
  pageWidths,
  teleports: withTemplate.filter((f) => /<Teleport\b/i.test(f.template.content)).map((f) => f.rel),
  layoutReadsInScript: files
    .filter((f) => f.scripts.some((s) => /getBoundingClientRect|innerWidth|ResizeObserver|matchMedia|offsetHeight/.test(s.content)))
    .map((f) => f.rel),
}

// --- tokens and value sprawl
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g
const customProps = decls.filter((d) => d.prop.startsWith('--'))
const tokenFiles = new Set(
  countBy(customProps.filter((d) => /:root|^html$/.test(d.selector)), (d) => d.rel)
    .filter(([, n]) => n >= 5)
    .map(([file]) => file),
)

const hexInStyle = decls.flatMap((d) => (d.value.match(HEX) ?? []).map((hex) => ({ hex: hex.toLowerCase(), rel: d.rel, line: d.line })))

// Outside <style>, only look where a colour can actually live, so that slot
// shorthands and fragment links are not mistaken for hex colours.
const hexOutsideStyle = []
// Plain script files are scanned too: a colour helper in utils/ feeds the
// same bindings as a colour written in a component.
for (const f of files) {
  if (f.template) {
    const attr = /(?::?style|fill|stroke|stop-color|flood-color|color|background)\s*=\s*(["'])([\s\S]*?)\1/g
    for (const m of f.template.content.matchAll(attr)) {
      // url(#gradient) is a reference to an element id, not a colour.
      for (const hex of m[2].replace(/url\(\s*#[^)]*\)/g, '').match(HEX) ?? []) {
        hexOutsideStyle.push({ hex: hex.toLowerCase(), rel: f.rel, line: lineAt(f.src, f.template.offset + m.index), where: 'template' })
      }
    }
  }
  for (const s of f.scripts) {
    for (const m of s.content.matchAll(/(['"`])(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4}))\1/g)) {
      hexOutsideStyle.push({ hex: m[2].toLowerCase(), rel: f.rel, line: lineAt(f.src, s.offset + m.index), where: 'script' })
    }
  }
}
const allHex = [...hexInStyle, ...hexOutsideStyle]

const SPACING = /^(padding|margin|gap|row-gap|column-gap)(-(top|right|bottom|left|block|inline))?$/
const spacingDecls = decls.filter((d) => SPACING.test(d.prop) && !d.value.includes('var('))
const spacingAtoms = spacingDecls.flatMap((d) => d.value.split(' ').filter((v) => toPx(v) !== null && toPx(v) !== 0))
const distinct = (prop) => new Set(decls.filter((d) => d.prop === prop && !d.value.includes('var(')).map((d) => d.value)).size

report.tokens = {
  customPropertiesDefined: customProps.length,
  varUses: decls.filter((d) => d.value.includes('var(--')).length,
  tokenFiles: [...tokenFiles],
  // @media blocks that only re-declare tokens on :root are not counted: this
  // number should only rise when the app's layout becomes responsive.
  mediaQueries: files.reduce(
    (n, f) =>
      n +
      f.styles.reduce(
        (k, s) => k + [...s.content.matchAll(/@media[^{]*\{\s*([^{}]+)\{/g)].filter((m) => m[1].trim() !== ':root').length,
        0,
      ),
    0,
  ),
  hex: {
    distinct: new Set(allHex.map((h) => h.hex)).size,
    uses: allHex.length,
    top: countBy(allHex, (h) => h.hex).slice(0, 10).map(([hex, count]) => ({ hex, count })),
    // Full palette with the properties each colour is used on, for deriving
    // token values. Only printed with --json.
    all: countBy(allHex, (h) => h.hex).map(([hex, count]) => ({
      hex,
      count,
      props: countBy(decls.filter((d) => d.value.toLowerCase().includes(hex)), (d) => d.prop.replace(/^border.*/, 'border')).slice(0, 3).map(([p, n]) => `${p} x${n}`),
    })),
    outsideStyle: hexOutsideStyle,
    outsideTokenFiles: allHex.filter((h) => !tokenFiles.has(h.rel)).length,
    inShellFiles: allHex.filter((h) => shellSet.has(h.rel)).length,
  },
  distinctValues: {
    'font-size': distinct('font-size'),
    'border-radius': distinct('border-radius'),
    'box-shadow': distinct('box-shadow'),
    padding: new Set(decls.filter((d) => /^padding/.test(d.prop)).map((d) => d.value)).size,
    margin: new Set(decls.filter((d) => /^margin/.test(d.prop)).map((d) => d.value)).size,
    gap: new Set(decls.filter((d) => /gap$/.test(d.prop)).map((d) => d.value)).size,
    spacingAtoms: new Set(spacingAtoms).size,
  },
  // Values that do not sit on a 4px grid, most used first.
  offGridSpacing: countBy(spacingAtoms.filter((v) => toPx(v) % 4 !== 0), (v) => v).map(([value, count]) => ({ value, count })),
}

// --- global styles and scoped redefinitions
const firstClass = (selector) => /^\.([\w-]+)/.exec(selector)?.[1] ?? null
const globalRules = rules.filter((r) => !r.scoped && !r.selector.startsWith('@'))
const globalClassOwner = new Map()
for (const r of globalRules) {
  for (const part of r.selector.split(',')) {
    const cls = firstClass(part.trim())
    if (cls && !globalClassOwner.has(cls)) globalClassOwner.set(cls, r.rel)
  }
}
const redefinitions = new Map()
for (const r of rules.filter((x) => x.scoped)) {
  for (const part of r.selector.split(',')) {
    const cls = firstClass(part.trim())
    const owner = cls ? globalClassOwner.get(cls) : null
    if (owner && owner !== r.rel) {
      if (!redefinitions.has(r.rel)) redefinitions.set(r.rel, new Set())
      redefinitions.get(r.rel).add(cls)
    }
  }
}
report.globals = {
  unscopedFiles: [...new Set(globalRules.map((r) => r.rel))],
  bareElementSelectors: [...new Set(
    globalRules
      .flatMap((r) => r.selector.split(',').map((s) => s.trim()))
      .filter((s) => /^[a-z][a-z0-9]*([\s:>+~]|$)/.test(s) && !/^(html|body)\b/.test(s))
      .map((s) => s.split(/[\s:>+~]/)[0]),
  )],
  scopedRedefinitions: [...redefinitions.entries()]
    .map(([file, classes]) => ({ rel: file, classes: [...classes].sort() }))
    .sort((a, b) => b.classes.length - a.classes.length),
}

// --- views
const viewFiles = vueFiles.filter((f) => VIEW_DIR.test(f.rel))
const importText = files.map((f) => ({ rel: f.rel, code: f.scripts.map((s) => s.content).join('\n') }))
report.views = {
  count: viewFiles.length,
  apiStyles: Object.fromEntries(viewFiles.map((f) => [f.rel, styleOf.get(f.rel)])),
  orphaned: viewFiles
    .filter((v) => {
      const name = escapeRegExp(path.basename(v.file, '.vue'))
      const pattern = new RegExp(`['"\`][^'"\`\\n]*\\b${name}(\\.vue)?['"\`]`)
      return !importText.some((f) => f.rel !== v.rel && pattern.test(f.code))
    })
    .map((f) => f.rel),
  withoutStyleBlock: viewFiles.filter((f) => f.styles.length === 0).map((f) => f.rel),
}

// --- width-sensitive layout that a ~250px sidebar squeezes
const widthSensitive = []
for (const d of decls) {
  const where = { rel: d.rel, line: d.line, selector: d.selector }
  if (d.prop === 'grid-template-columns') {
    const min = /minmax\(\s*(\d+)px/.exec(d.value)
    if (min && Number(min[1]) >= 300) widthSensitive.push({ ...where, why: `grid minmax(${min[1]}px)` })
    // "1fr 1fr" has no word boundary before "fr", so match the digit with it.
    else if (!/auto-fi(t|ll)|minmax/.test(d.value) && /(\dfr\s.*\dfr|repeat\(\s*[2-9]\s*,)/.test(d.value)) {
      widthSensitive.push({ ...where, why: `fixed columns (${d.value})` })
    }
  } else if (d.prop === 'table-layout' && d.value === 'fixed') {
    widthSensitive.push({ ...where, why: 'table-layout: fixed' })
  } else if (d.prop === 'min-width' && (toPx(d.value) ?? 0) >= 300) {
    widthSensitive.push({ ...where, why: `min-width: ${d.value}` })
  }
}
report.widthSensitive = widthSensitive

// --- fonts
const SYSTEM_FONTS = new Set([
  'system-ui', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'sans-serif', 'serif', 'monospace', 'inherit', 'initial',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', 'arial', 'helvetica', 'helvetica neue', 'georgia', 'times new roman', 'verdana',
  'tahoma', 'trebuchet ms', 'courier new', 'courier', 'monaco', 'menlo', 'consolas', 'sf mono', 'sfmono-regular',
])
let indexHtml = ''
for (const candidate of ['index.html', 'public/index.html']) {
  const p = projectRoot ? path.join(projectRoot, candidate) : null
  if (p && fs.existsSync(p)) indexHtml += fs.readFileSync(p, 'utf8')
}
const allStyleText = files.flatMap((f) => f.styles.map((s) => s.content)).join('\n')
const primaryFonts = countBy(
  decls
    .filter((d) => d.prop === 'font-family' && !d.value.includes('var('))
    .map((d) => d.value.split(',')[0].trim().replace(/^['"]|['"]$/g, ''))
    .filter((name) => name && !SYSTEM_FONTS.has(name.toLowerCase())),
  (name) => name,
).map(([name]) => name)
const fontLoaded = (name) => {
  const escaped = escapeRegExp(name)
  const slug = name.toLowerCase().replace(/\s+/g, '-')
  return (
    new RegExp(`@font-face[^}]*${escaped}`, 'i').test(allStyleText) ||
    new RegExp(`fonts\\.[^"'>]*${escaped.replace(/ /g, '(\\+|%20| )')}`, 'i').test(indexHtml + allStyleText) ||
    depNames.some((d) => d.toLowerCase().includes(`fontsource`) && d.toLowerCase().endsWith(slug))
  )
}
report.fonts = primaryFonts.map((name) => ({ name, loaded: fontLoaded(name) }))

// --- accessibility baseline
const templates = withTemplate.map((f) => f.template.content).join('\n')
report.a11y = {
  ariaAttributes: (templates.match(/\saria-[a-z]+=/g) ?? []).length,
  roles: (templates.match(/\srole=/g) ?? []).length,
  focusVisibleRules: rules.filter((r) => r.selector.includes(':focus-visible')).length,
  outlineRemoved: decls.filter((d) => d.prop === 'outline' && /^(none|0)$/.test(d.value)).length,
  navWithoutLabel: withTemplate.filter((f) => /<nav\b(?![^>]*aria-label)/.test(f.template.content)).map((f) => f.rel),
  skipLink: /href=["']#(main|content)/i.test(templates),
}

// --- scorecard: the numbers the skill re-checks after each phase
report.scorecard = {
  coupledOffsets: report.layout.coupledOffsets.length,
  mediaQueries: report.tokens.mediaQueries,
  customPropertiesDefined: report.tokens.customPropertiesDefined,
  hexInShellFiles: report.tokens.hex.inShellFiles,
  hexOutsideTokenFiles: report.tokens.hex.outsideTokenFiles,
  duplicatedPageWidths: report.layout.pageWidths.filter((w) => w.count > 1).length,
  scopedRedefinitions: report.globals.scopedRedefinitions.reduce((n, r) => n + r.classes.length, 0),
  missingLocaleKeys: report.shell.missingLocaleKeys.length + report.shell.hardcodedLabels.length,
  fontsNamedNotLoaded: report.fonts.filter((f) => !f.loaded).length,
}

// ---------------------------------------------------------------- output

// No process.exit() after printing: exiting early can cut off output that is
// still being written to a pipe.
const out = []
const h = (title) => out.push('', title)
const row = (label, value) => out.push(`  ${(label + ' ').padEnd(26, '.')} ${value}`)
function list(items, format, max = 6) {
  items.slice(0, max).forEach((item) => out.push(`      ${format(item)}`))
  if (items.length > max) out.push(`      ... ${items.length - max} more (use --json for all)`)
}
const at = (x) => `${x.rel}:${x.line}`

out.push(isRerun ? `vue-saas-redesign audit (re-run, old nav height ${navPxArg.join(', ')}px)` : 'vue-saas-redesign audit')
row('source', report.source)
row('project', report.project.root ? `${report.project.root} (vue ${report.project.vue ?? 'not found'})` : 'no package.json found')
row('files', `${vueFiles.length} .vue, ${files.length - vueFiles.length} other`)
row('component API styles', Object.entries(report.apiStyles).map(([k, v]) => `${k} ${v}`).join(', ') || 'none')

h('STOP CONDITIONS')
if (report.stop.length) report.stop.forEach((s) => out.push(`  STOP: ${s}`))
else out.push('  none')
report.warnings.forEach((w) => out.push(`  WARNING: ${w}`))

h('SHELL')
row('shell file', report.shell.shellFiles.map((f) => `${f.rel} (${f.api})`).join(', ') || 'not found: no <router-view>')
row('nav file', report.shell.navFiles.map((f) => `${f.rel} (${f.links} links, ${f.api}${f.manualActiveClass ? ', manual active class' : ''})`).join(', ') || 'not found')
row('router', report.shell.router ? `${report.shell.router.rel} (${routes.length} routes, ${report.shell.router.hashMode ? 'HASH mode' : 'history mode'})` : 'not found')
row('nav height', navHeights.map((n) => `${n.value} = ${n.px}px (${n.selector}, ${at(n)})`).join('; ') || 'not detected')
row('offsets tied to nav', report.layout.coupledOffsets.length)
list(report.layout.coupledOffsets, (d) => `${at(d)}  ${d.selector} { ${d.decl} }`)
row('rendered before <main>', siblingsBeforeMain.map((s) => `${s.component} (${s.rel ?? 'unresolved'})`).join(', ') || 'none')
row('mounted in header', report.layout.headerMounted.map((c) => c.component).join(', ') || 'none')
row('sticky or fixed rules', positioned.length)
list(positioned, (p) => `${at(p)}  ${p.selector} { ${p.position}; top: ${p.top ?? 'unset'}; z-index: ${p.zIndex ?? 'unset'} }`)
row('dropdowns opening down', dropdowns.length)
list(dropdowns, (d) => `${at(d)}  ${d.selector} (${d.align}-aligned, min-width ${d.minWidth ?? 'unset'}${d.inHeader ? ', in header' : ''})`)
row('page-width containers', report.layout.pageWidths.map((w) => `${w.value} x${w.count}`).join(', ') || 'none')
list(report.layout.pageWidths.filter((w) => w.count > 1).flatMap((w) => w.where), (w) => w)
row('z-index ladder', zIndex.map((z) => `${z.value} (x${z.count})`).join(', ') || 'none')
row('teleported components', report.layout.teleports.length)
row('script reads layout', report.layout.layoutReadsInScript.join(', ') || 'none')

h('NAVIGATION')
list(navLinks, (l) => `${String(l.to ?? '?').padEnd(14)} ${l.kind === 'i18n' ? `t('${l.key}')` : JSON.stringify(l.label)}${l.kind === 'hardcoded' && usesI18n ? '  <- hardcoded, no locale key' : ''}`, 12)
row('locale files', report.shell.localeFiles.join(', ') || 'none')
row('keys used by the shell', `${report.shell.keysChecked} checked, ${missingKeys.length} missing`)
list(missingKeys, (k) => `${k.key} (used in ${k.usedIn}) missing in ${k.missingIn.join(', ')}`)

h('TOKENS AND SPRAWL')
row('custom properties', `${report.tokens.customPropertiesDefined} defined, ${report.tokens.varUses} declarations use var()`)
row('@media rules', report.tokens.mediaQueries)
row('hex colours', `${report.tokens.hex.distinct} distinct, ${report.tokens.hex.uses} uses`)
row('top colours', report.tokens.hex.top.slice(0, 8).map((c) => `${c.hex} x${c.count}`).join(', ') || 'none')
row('hex outside <style>', hexOutsideStyle.length)
list(hexOutsideStyle, (x) => `${at(x)}  ${x.hex} (${x.where})`, 5)
row('distinct values', Object.entries(report.tokens.distinctValues).map(([k, v]) => `${k} ${v}`).join(', '))
row('off-grid spacing', report.tokens.offGridSpacing.map((s) => `${s.value} x${s.count}`).join(', ') || 'none')
row('fonts', report.fonts.map((f) => `${f.name} (${f.loaded ? 'loaded' : 'named but NOT loaded'})`).join(', ') || 'system fonts only')
row('icon libraries', report.project.iconLibraries.join(', ') || 'none')

h('GLOBAL STYLES')
row('unscoped style in', report.globals.unscopedFiles.join(', ') || 'none')
row('bare element selectors', report.globals.bareElementSelectors.join(', ') || 'none')
row('scoped redefinitions', `${report.scorecard.scopedRedefinitions} in ${report.globals.scopedRedefinitions.length} files`)
list(report.globals.scopedRedefinitions, (r) => `${r.rel}  ${r.classes.map((c) => '.' + c).join(' ')}`)

h('VIEWS')
row('views', `${report.views.count} files, ${routes.length} routes`)
row('orphaned (not imported)', report.views.orphaned.join(', ') || 'none')
row('width-sensitive rules', widthSensitive.length)
list(widthSensitive, (w) => `${at(w)}  ${w.selector} { ${w.why} }`, 8)

h('ACCESSIBILITY BASELINE')
row('aria attributes', report.a11y.ariaAttributes)
row(':focus-visible rules', report.a11y.focusVisibleRules)
row('outline removed', report.a11y.outlineRemoved)
row('<nav> without aria-label', report.a11y.navWithoutLabel.join(', ') || 'none')
row('skip link', report.a11y.skipLink ? 'present' : 'absent')

h('SCORECARD')
for (const [key, value] of Object.entries(report.scorecard)) row(key, value)

console.log(asJson ? JSON.stringify(report, null, 2) : out.join('\n'))

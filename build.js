#!/usr/bin/env node
/**
 * Minimal modern build: produces the three CSS bundles + fonts in dist/.
 *
 * Divergence from upstream botoxparty/XP.css:
 * - docs/website build removed (ejs, highlight.js, glob, gh-pages, live-server
 *   were only needed for that and carried all of the flagged dependencies).
 * - glob/mkdirp/dedent replaced by Node built-ins (fs/path).
 * - gui/fonts/converted is copied into dist/fonts/converted so that the
 *   url("fonts/converted/...") references emitted from @font-face resolve
 *   for consumers of dist/XP.css (they never resolvable before; downstream
 *   tools like pandoc --embed-resources could not find the fonts).
 * The CSS pipeline itself (the set of postcss plugins) is unchanged so the
 * bundle output remains faithful.
 */
const fs = require("fs");
const path = require("path");
const postcss = require("postcss");

const { homepage, version } = require("./package.json");

function loadPlugin(mod, opts) {
  const p = require(mod);
  const plugin = p && p.__esModule && p.default ? p.default : p;
  if (typeof plugin === "function") {
    return typeof opts !== "undefined" ? plugin(opts) : plugin();
  }
  return plugin;
}

const postcssParser = postcss()
  .use(loadPlugin("postcss-import"))
  .use(loadPlugin("postcss-nested"))
  .use(loadPlugin("postcss-inline-svg"))
  .use(loadPlugin("postcss-css-variables"))
  .use(loadPlugin("postcss-calc"))
  .use(loadPlugin("cssnano"));

function copyFonts() {
  const from = "gui/fonts/converted";
  const to = path.join("dist", "fonts", "converted");
  fs.mkdirSync(to, { recursive: true });
  for (const file of fs.readdirSync(from)) {
    fs.copyFileSync(path.join(from, file), path.join(to, file));
  }
}

// Remove artifacts left behind by the upstream docs build (no longer produced)
const STALE_DOCS_FILES = [
  "docs.css",
  "index.html",
  "index.html.ejs",
  "script.js",
  "vs.css",
  "icon.png",
  "window.png",
];

function removeStaleDocs() {
  for (const name of STALE_DOCS_FILES) {
    const target = path.join("dist", name);
    if (fs.existsSync(target)) fs.rmSync(target);
  }
}

function buildTheme(outName, themeDir) {
  const src = path.join(themeDir, "index.scss");
  const input =
    `/*! ${outName} v${version} - ${homepage} */\n` +
    fs.readFileSync(src);

  return postcssParser
    .process(input, {
      from: src,
      to: path.join("dist", outName),
      map: { inline: false },
    })
    .then((result) => {
      fs.mkdirSync("dist", { recursive: true });
      fs.writeFileSync(path.join("dist", outName), result.css);
      fs.writeFileSync(path.join("dist", `${outName}.map`), result.map.toString());
    });
}

function build() {
  return Promise.all([
    buildTheme("98.css", "themes/98"),
    buildTheme("GUI.css", "gui"),
    buildTheme("XP.css", "themes/XP"),
  ])
    .then(copyFonts)
    .then(removeStaleDocs)
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

module.exports = build;

build();

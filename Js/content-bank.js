/* =====================================================
   SALC Iran — main.js
   1) Theme (dark mode toggle)
   2) Content bank (learning topics + activities)
   3) AI conversation prompt library
   ===================================================== */


/* =====================================================
   1. Theme (dark mode)
   Default: LIGHT
   Dark mode is enabled only by user choice.
   ===================================================== */

(function () {
    const STORAGE_KEY = "salc-theme";
    const root = document.documentElement;

    function getSavedTheme() {
        try {
            const theme = localStorage.getItem(STORAGE_KEY);

            return theme === "dark" || theme === "light"
                ? theme
                : null;
        } catch (error) {
            return null;
        }
    }

    function applyTheme(theme) {
        const selectedTheme = theme === "dark" ? "dark" : "light";

        root.dataset.theme = selectedTheme;

        document.querySelectorAll(".theme-toggle").forEach(button => {
            button.setAttribute(
                "aria-pressed",
                String(selectedTheme === "dark")
            );
        });
    }

    // Use the saved preference, or LIGHT if no preference exists.
    // Do not follow the operating system's dark mode setting.
    applyTheme(getSavedTheme() || "light");

    function initializeThemeToggle() {
        document.querySelectorAll(".theme-toggle").forEach(button => {
            // Avoid registering the same listener more than once.
            if (button.dataset.themeInitialized === "true") return;

            button.dataset.themeInitialized = "true";

            button.addEventListener("click", function () {
                const currentTheme = root.dataset.theme || "light";

                const nextTheme =
                    currentTheme === "dark" ? "light" : "dark";

                applyTheme(nextTheme);

                try {
                    localStorage.setItem(STORAGE_KEY, nextTheme);
                } catch (error) {
                    // The toggle still works if storage is unavailable.
                }
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeThemeToggle,
            { once: true }
        );
    } else {
        initializeThemeToggle();
    }
})();


/* =====================================================
   2. Content bank
   ===================================================== */

const CONTENT_BANK_URL = "../data/content-bank.json";


function escapeHTML(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


// Only allow HTTP and HTTPS URLs.
function safeUrl(url) {
    if (!url) return null;

    try {
        const parsed = new URL(url, window.location.href);

        return ["http:", "https:"].includes(parsed.protocol)
            ? escapeHTML(url)
            : null;
    } catch (error) {
        return null;
    }
}


// Validate the content bank and report problems in the console.
function validateContentBank(data) {
    const problems = [];
    const topicIds = new Set();
    const activityIds = new Set();

    const missing = value =>
        value === undefined || value === null || value === "";

    (data.topics || []).forEach((topic, i) => {
        const where = `topics[${i}]`;

        ["id", "title", "level", "description", "learning_outcome"]
            .forEach(field => {
                if (missing(topic[field])) {
                    problems.push(`${where}: missing "${field}"`);
                }
            });

        if (topicIds.has(topic.id)) {
            problems.push(`${where}: duplicate id "${topic.id}"`);
        }

        topicIds.add(topic.id);

        const stages = new Set();

        (topic.activities || []).forEach((activity, j) => {
            const w = `${topic.id || where}.activities[${j}]`;

            ["id", "stage", "skill", "title", "description", "status"]
                .forEach(field => {
                    if (missing(activity[field])) {
                        problems.push(`${w}: missing "${field}"`);
                    }
                });

            if (activityIds.has(activity.id)) {
                problems.push(`${w}: duplicate id "${activity.id}"`);
            }

            activityIds.add(activity.id);

            if (stages.has(activity.stage)) {
                problems.push(
                    `${w}: duplicate stage ${activity.stage}`
                );
            }

            stages.add(activity.stage);

            if (!["available", "planned"].includes(activity.status)) {
                problems.push(
                    `${w}: unknown status "${activity.status}"`
                );
            }

            if (
                activity.status === "available" &&
                missing(activity.url)
            ) {
                problems.push(
                    `${w}: status is "available" but url is missing`
                );
            }
        });
    });

    problems.forEach(problem => {
        console.warn("Content bank:", problem);
    });

    return problems;
}


function renderActivity(activity) {
    const url =
        activity.status === "available"
            ? safeUrl(activity.url)
            : null;

    return `
        <article class="activity-item">
            <span class="content-skill">
                Step ${escapeHTML(activity.stage)} ·
                ${escapeHTML(activity.skill)}
            </span>

            <h4>${escapeHTML(activity.title)}</h4>

            <p>${escapeHTML(activity.description)}</p>

            ${
                url
                    ? `<a class="check-button" href="${url}">
                           Start Activity →
                       </a>`
                    : `<span class="content-coming-soon">
                           Coming soon
                       </span>`
            }
        </article>
    `;
}


function renderTopic(topic, index, containerId) {
    const key = topic.id
        ? String(topic.id).replace(/[^\w-]/g, "")
        : index;

    const panelId = `${containerId}-panel-${key}`;

    const activities = (topic.activities || [])
        .slice()
        .sort((a, b) => (a.stage ?? 0) - (b.stage ?? 0))
        .map(renderActivity)
        .join("");

    // Optional second-language title.
    const titleFa = topic.title_fa
        ? `
            <span class="topic-title-fa" lang="fa" dir="rtl">
                ${escapeHTML(topic.title_fa)}
            </span>
          `
        : "";

    return `
        <article class="content-card topic-card">

            <h2 class="topic-heading">

                <button
                    class="topic-toggle"
                    type="button"
                    aria-expanded="false"
                    aria-controls="${panelId}"
                >

                    <span class="topic-card-content">

                        <span class="topic-label">
                            ${escapeHTML(topic.level)} Learning Topic
                        </span>

                        <span class="topic-title">
                            ${escapeHTML(topic.title)}
                        </span>

                        ${titleFa}

                    </span>

                    <span
                        class="topic-arrow"
                        aria-hidden="true"
                    ></span>

                </button>

            </h2>

            <div class="topic-summary">

                <p>${escapeHTML(topic.description)}</p>

                <p class="topic-outcome">
                    <strong>Learning outcome:</strong>
                    ${escapeHTML(topic.learning_outcome)}
                </p>

            </div>

            <div
                class="topic-activities"
                id="${panelId}"
                hidden
            >

                <h3>Activities</h3>

                <div class="activity-grid">
                    ${activities}
                </div>

            </div>

        </article>
    `;
}


async function loadContentBank(
    level,
    containerId = "content-bank"
) {
    const container = document.getElementById(containerId);

    if (!container || !level) return;

    container.setAttribute("aria-busy", "true");

    container.innerHTML = `
        <p role="status">
            Loading learning resources...
        </p>
    `;

    try {
        const response = await fetch(CONTENT_BANK_URL);

        if (!response.ok) {
            throw new Error(
                `Could not load the content bank (${response.status}).`
            );
        }

        const data = await response.json();

        validateContentBank(data);

        const wanted = String(level).toUpperCase();

        const topics = (
            Array.isArray(data.topics) ? data.topics : []
        ).filter(topic =>
            String(topic.level || "").toUpperCase() === wanted
        );

        if (topics.length === 0) {
            container.innerHTML = `
                <p>
                    Learning activities for this level are coming soon.
                </p>
            `;
            return;
        }

        container.innerHTML = topics
            .map((topic, index) =>
                renderTopic(topic, index, containerId)
            )
            .join("");

        // Event delegation for expanding and collapsing topic cards.
        container.onclick = event => {
            const button = event.target.closest(".topic-toggle");

            if (!button || !container.contains(button)) return;

            const panelId = button.getAttribute("aria-controls");
            const panel = document.getElementById(panelId);

            if (!panel || !container.contains(panel)) return;

            const isExpanded =
                button.getAttribute("aria-expanded") === "true";

            button.setAttribute(
                "aria-expanded",
                String(!isExpanded)
            );

            panel.hidden = isExpanded;
        };

    } catch (error) {
        console.error("Content bank error:", error);

        container.innerHTML = `
            <p role="alert">
                Learning resources could not be loaded.
                Please try again later.
            </p>
        `;

    } finally {
        container.removeAttribute("aria-busy");
    }
}


/* =====================================================
   3. AI conversation prompt library
   ===================================================== */

const PROMPTS_URL = "../data/prompts.json";


// Providers that support prompt URL prefill.
const AI_PROVIDERS = [
    {
        id: "chatgpt",
        name: "ChatGPT",
        url: "https://chatgpt.com/",
        param: "q"
    },
    {
        id: "claude",
        name: "Claude",
        url: "https://claude.ai/new",
        param: "q"
    },
    {
        id: "gemini",
        name: "Gemini",
        url: "https://gemini.google.com/app",
        param: null
    }
];


// If a URL is too long, open the provider without prefilled text.
const MAX_URL_LENGTH = 4000;

const promptsById = new Map();


/* ---------- Helpers ---------- */


function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs)) {
        if (value === null || value === undefined || value === false) {
            continue;
        }

        if (key === "text") {
            node.textContent = value;
        } else {
            node.setAttribute(
                key,
                value === true ? "" : value
            );
        }
    }

    [].concat(children).forEach(child => {
        if (child) node.append(child);
    });

    return node;
}


function slugify(text) {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "prompt";
}


async function copyText(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (error) {
        // Fall back to the older clipboard method.
    }

    const area = el("textarea", {
        readonly: true,
        "aria-hidden": "true",
        style: "position:fixed;opacity:0;pointer-events:none;"
    });

    area.value = text;

    document.body.append(area);

    area.select();

    let ok = false;

    try {
        ok = document.execCommand("copy");
    } catch (error) {
        ok = false;
    }

    area.remove();

    return ok;
}


function downloadText(filename, text) {
    const blob = new Blob(
        [text],
        { type: "text/plain;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);

    const link = el("a", {
        href: url,
        download: filename
    });

    document.body.append(link);

    link.click();

    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}


function promptFileText(item) {
    return [
        `${item.title} (${item.level})`,
        "=".repeat(40),
        "How to use: paste the prompt below into ChatGPT, Claude, Gemini, or another AI chat.",
        "Then answer the AI's questions in English. Do not share passwords or private information.",
        "",
        "--- Copy everything below this line ---",
        "",
        item.prompt
    ].join("\n");
}


function providerLink(provider, text) {
    if (!provider.param) {
        return provider.url;
    }

    const full =
        `${provider.url}?${provider.param}=${encodeURIComponent(text)}`;

    return full.length <= MAX_URL_LENGTH
        ? full
        : provider.url;
}


function flash(button, label) {
    const original = button.dataset.label || button.textContent;

    button.dataset.label = original;

    button.textContent = label;

    clearTimeout(button._timer);

    button._timer = setTimeout(() => {
        button.textContent = original;
    }, 1800);
}


function announce(container, message) {
    const status = container.querySelector(".prompt-status");

    if (status) {
        status.textContent = message;
    }
}


/* ---------- Rendering ---------- */


function renderPrompt(item) {
    const titleId = `prompt-title-${item.id}`;

    const openLinks = AI_PROVIDERS.map(provider =>
        el("a", {
            class: "prompt-btn",
            href: providerLink(provider, item.prompt),
            target: "_blank",
            rel: "noopener noreferrer",
            "data-action": "open",
            "data-id": item.id,
            "data-provider": provider.id,
            "aria-label":
                `Open in ${provider.name} (new tab, prompt is copied)`,
            text: provider.name
        })
    );

    return el("article", {
        class: "prompt-card",
        "aria-labelledby": titleId
    }, [
        el("div", { class: "prompt-meta" }, [
            el("span", {
                class: "prompt-level",
                text: item.level
            }),

            item.time_minutes
                ? el("span", {
                    class: "prompt-time",
                    text: `${item.time_minutes} min`
                })
                : null
        ]),

        el("h3", {
            id: titleId,
            text: item.title
        }),

        item.description
            ? el("p", { text: item.description })
            : null,

        el("details", {
            class: "prompt-preview"
        }, [
            el("summary", {
                text: "Preview prompt"
            }),

            el("pre", {
                text: item.prompt
            })
        ]),

        el("div", {
            class: "prompt-actions"
        }, [
            el("button", {
                class: "prompt-btn prompt-btn--primary",
                type: "button",
                "data-action": "copy",
                "data-id": item.id,
                text: "Copy prompt"
            }),

            el("button", {
                class: "prompt-btn",
                type: "button",
                "data-action": "download",
                "data-id": item.id,
                text: "Download .txt"
            }),

            el("div", {
                class: "prompt-open"
            }, [
                el("span", {
                    text: "Open in:"
                }),

                ...openLinks
            ])
        ])
    ]);
}


/* ---------- Prompt click handling ---------- */


async function handlePromptClick(event, container) {
    const target = event.target.closest("[data-action]");

    if (!target || !container.contains(target)) return;

    const action = target.dataset.action;

    if (action === "download-all") {
        const all = [...promptsById.values()];

        const text = all
            .map(promptFileText)
            .join(
                "\n\n" +
                "=".repeat(60) +
                "\n\n"
            );

        downloadText(
            `salc-${slugify(container.dataset.level || "all")}-prompts.txt`,
            text
        );

        announce(container, "Download started.");

        return;
    }

    const item = promptsById.get(target.dataset.id);

    if (!item) return;

    if (action === "copy") {
        const ok = await copyText(item.prompt);

        flash(
            target,
            ok ? "Copied ✓" : "Copy failed"
        );

        announce(
            container,
            ok
                ? "Prompt copied. Paste it into an AI chat."
                : "Could not copy. Open the preview and copy the text manually."
        );
    }

    if (action === "download") {
        downloadText(
            `salc-${slugify(item.title)}.txt`,
            promptFileText(item)
        );

        announce(container, "Download started.");
    }

    if (action === "open") {
        // Let the link open normally.
        // Copy the prompt as a backup.
        const ok = await copyText(item.prompt);

        announce(
            container,
            ok
                ? "Prompt copied. If the chat opens with an empty box, paste it with Ctrl+V (Cmd+V on Mac)."
                : "The chat is opening. If the box is empty, use Copy prompt and paste it."
        );
    }
}


/* ---------- Main ---------- */


async function loadPromptLibrary(
    level,
    containerId = "prompt-library"
) {
    const container = document.getElementById(containerId);

    if (!container || !level) return;

    container.setAttribute("aria-busy", "true");

    container.replaceChildren(
        el("p", {
            role: "status",
            text: "Loading practice prompts..."
        })
    );

    try {
        const response = await fetch(PROMPTS_URL);

        if (!response.ok) {
            throw new Error(
                `Could not load prompts (${response.status}).`
            );
        }

        const data = await response.json();

        const wanted = String(level).toUpperCase();

        const items = (
            Array.isArray(data.prompts) ? data.prompts : []
        ).filter(item =>
            item &&
            item.id &&
            item.title &&
            item.prompt &&
            String(item.level || "").toUpperCase() === wanted
        );

        if (items.length === 0) {
            container.replaceChildren(
                el("p", {
                    text:
                        "Practice prompts for this level are coming soon."
                })
            );

            return;
        }

        promptsById.clear();

        items.forEach(item => {
            promptsById.set(item.id, item);
        });

        container.dataset.level = wanted;

        container.replaceChildren(
            el("div", {
                class: "prompt-toolbar"
            }, [
                el("p", {
                    text:
                        `${items.length} practice prompts for ${wanted}`
                }),

                el("button", {
                    class: "prompt-btn",
                    type: "button",
                    "data-action": "download-all",
                    text:
                        `Download all ${wanted} prompts (.txt)`
                })
            ]),

            el("div", {
                class: "prompt-grid"
            }, items.map(renderPrompt)),

            el("p", {
                class: "prompt-status",
                role: "status",
                "aria-live": "polite"
            })
        );

        container.onclick = event => {
            handlePromptClick(event, container);
        };

    } catch (error) {
        console.error("Prompt library error:", error);

        container.replaceChildren(
            el("p", {
                role: "alert",
                text:
                    "Practice prompts could not be loaded. Please try again later."
            })
        );

    } finally {
        container.removeAttribute("aria-busy");
    }
}

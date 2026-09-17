# Typing Race

Браузерний тренажер сенсорного набору українською та англійською мовами: три етапи навчання, аналітика помилок і ритму, гонки в реальному часі та груповий рейтинг.

Проєкт створюється за [технічним завданням хакатону](https://github.com/StsZu/Typing-Race-2026-Hackathon).

## Стан

**Етап документації.** Коду застосунку ще немає: спершу готується повний пакет документації — специфікація, план, системний дизайн, схеми екранів і розбиття на задачі. Імплементація починається лише після цього.

## Структура

```text
.scratch/typing-race-hackathon/   карта рішень і тікети (wayfinder)
docs/adr/                         архітектурні рішення
docs/research/                    звіти досліджень із посиланнями на першоджерела
docs/agents/                      домовленості для агентів
specs/                            специфікації Spec Kit
.specify/                         шаблони й конституція Spec Kit
AGENTS.md, CLAUDE.md              інструкції для агентів розробки
CONTEXT.md                        глосарій предметної області
```

## Дослідження

| Звіт | Про що |
|---|---|
| [02](docs/research/02-typing-trainers.md) | розбір механіки Monkeytype, keybr та інших тренажерів |
| [03](docs/research/03-frontend-stack.md) | фронтенд-стек і рушій вводу |
| [04](docs/research/04-animation-libraries.md) | бібліотеки анімацій |
| [05](docs/research/05-supabase-vercel.md) | ліміти Supabase Free і Vercel Hobby |
| [06](docs/research/06-quality-tooling.md) | інструменти E2E-тестування та CI |
| [07](docs/research/07-speckit-pocock-workflow.md) | процес мультиагентної розробки |
| [08](docs/research/08-dictionaries.md) | словники: ліцензії, нормалізація, заміри |

## Локальна робота

Копії сторонніх скілів і словники організатора в репозиторій не входять. Щоб відновити оточення:

```bash
# скіли Matt Pocock — за маніфестом skills-lock.json
# каркас Spec Kit
specify init --here
# знімок словників організатора (не комітиться)
git clone https://github.com/StsZu/Typing-Race-2026-Hackathon.git tasks/Typing-Race-2026-Hackathon
```

Змінні середовища — за зразком [.env.example](.env.example). Справжні ключі зберігаються лише в секретах Vercel і GitHub.

## Використання AI

Проєкт розробляється з Claude Code. Декларація про роль AI, перелік джерел даних із ліцензіями та сторінка формул метрик будуть додані разом із застосунком.

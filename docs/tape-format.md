# Tape format, version 1

The editor-facing contract is [tape.schema.json](../schema/tape.schema.json), using [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/json-schema-validation). The MoonBit kernel remains the authority for replay and policy decisions.

| Field | Meaning and bounds |
| --- | --- |
| `version` | Integer `1` |
| `policy.allowed_tools` | Unique nonempty tool names; at most 300 names |
| `policy.side_effect_tools` | Tools requiring prior approval; same name constraints |
| `policy.max_total_cost` | Integer 0–100,000,000, in caller-defined recorded units |
| `policy.max_calls` | Integer 0–300 |
| `events` | At most 300 call or approval events |
| `fixtures` | At most 300 exact `(tool, args_key)` response records |

Each event has `id`, `kind`, `tool`, `args_key`, `result`, `cost`, and `target`. IDs and tool names are nonempty and at most 120 units. Argument keys are at most 4,000 units and results at most 8,000. Costs are integers between 0 and 1,000,000. A call uses `kind: "call"` and `target: ""`. An approval uses `kind: "approve"`, zero cost, and the target call ID.

A fixture has `tool`, `args_key`, and `result`, with the same field bounds as an event. Extra object properties are ignored by the kernel and permitted by the schema.

The schema checks structural constraints. Event ID uniqueness, fixture key uniqueness, approval order and binding, allowlists, budgets, and response drift are checked by the kernel. Structurally valid tapes can intentionally describe policy violations. Sharing a tape requires removing private data beforehand.

String bounds in the JavaScript kernel count UTF-16 units; JSON Schema `maxLength` counts Unicode characters. A tape containing supplementary characters may pass structural validation but exceed a kernel field limit. Serialized input is additionally limited to 200,000 UTF-16 units; reduction accepts at most 60 events. These runtime constraints are enforced after schema-independent JSON decoding.

Use `npm run check` for the supplied regression suite. Optional contract checks run with `python3 tests/schema_contract.py` after installing `requirements-validation.txt`.

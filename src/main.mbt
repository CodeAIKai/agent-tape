///|
/// One fixture is a recorded tool response, keyed by exact tool and arguments.
struct Fixture {
  tool : String
  args_key : String
  result : String
} derive(ToJson, @json.FromJson)

///|
/// Approval events bind to a future call ID and the exact arguments.
struct Event {
  id : String
  kind : String
  tool : String
  args_key : String
  cost : Int
  result : String
  target : String
} derive(ToJson, @json.FromJson)

///|
/// Side effects are classified by policy, never by a model-provided flag.
struct Policy {
  allowed_tools : Array[String]
  side_effect_tools : Array[String]
  max_total_cost : Int
  max_calls : Int
} derive(ToJson, @json.FromJson)

///|
struct Tape {
  version : Int
  policy : Policy
  fixtures : Array[Fixture]
  events : Array[Event]
} derive(ToJson, @json.FromJson)

///|
struct Violation {
  step : Int
  event_id : String
  code : String
  message : String
} derive(ToJson)

///|
struct ReplayStep {
  step : Int
  event_id : String
  tool : String
  result : String
  source : String
} derive(ToJson)

///|
struct Report {
  ok : Bool
  calls : Int
  total_cost : Int
  violations : Array[Violation]
  replay : Array[ReplayStep]
  network_calls : Int
  engine : String
} derive(ToJson)

///|
fn has(items : Array[String], value : String) -> Bool {
  for item in items {
    if item == value {
      return true
    }
  }
  false
}

///|
fn violation(
  step : Int,
  id : String,
  code : String,
  message : String,
) -> Violation {
  { step, event_id: id, code, message, }
}

///|
fn valid_tool_names(items : Array[String]) -> Bool {
  if items.length() > 300 {
    return false
  }
  let seen : Array[String] = []
  for item in items {
    if item.length() == 0 || item.length() > 120 || has(seen, item) {
      return false
    }
    seen.push(item)
  }
  true
}

///|
/// Validate shape and bounds before replay. No partial report is trusted.
fn shape_errors(t : Tape) -> Array[Violation] {
  let errors : Array[Violation] = []
  if t.version != 1 {
    errors.push(
      violation(-1, "schema", "SCHEMA", "Only tape version 1 is supported"),
    )
  }
  if t.events.length() > 300 || t.fixtures.length() > 300 {
    errors.push(
      violation(-1, "schema", "LIMIT", "Maximum 300 events and fixtures"),
    )
    return errors
  }
  if !valid_tool_names(t.policy.allowed_tools) ||
    !valid_tool_names(t.policy.side_effect_tools) {
    errors.push(
      violation(
        -1, "policy", "SCHEMA", "Tool lists require unique nonempty names of at most 120 characters, with at most 300 entries",
      ),
    )
  }
  if t.policy.max_total_cost < 0 ||
    t.policy.max_total_cost > 100000000 ||
    t.policy.max_calls < 0 ||
    t.policy.max_calls > 300 {
    errors.push(violation(-1, "policy", "SCHEMA", "Invalid policy bounds"))
  }
  let ids : Array[String] = []
  for i, e in t.events {
    if e.id.length() == 0 || e.id.length() > 120 || has(ids, e.id) {
      errors.push(
        violation(i, e.id, "SCHEMA", "Event IDs must be nonempty and unique"),
      )
    }
    ids.push(e.id)
    if e.kind != "call" && e.kind != "approve" {
      errors.push(violation(i, e.id, "SCHEMA", "Unknown event kind"))
    }
    if e.cost < 0 ||
      e.cost > 1000000 ||
      e.tool.length() == 0 ||
      e.tool.length() > 120 ||
      e.args_key.length() > 4000 ||
      e.result.length() > 8000 {
      errors.push(violation(i, e.id, "SCHEMA", "Invalid event bounds"))
    }
    if e.kind == "approve" && e.cost != 0 {
      errors.push(
        violation(i, e.id, "SCHEMA", "Approval events cannot incur tool cost"),
      )
    }
    if (
        e.kind == "approve" &&
        (e.target.length() == 0 || e.target.length() > 120)
      ) ||
      (e.kind == "call" && e.target != "") {
      errors.push(
        violation(
          i,
          e.id,
          "SCHEMA",
          "Approvals require a target call ID; call events require an empty target",
        ),
      )
    }
  }
  for i, f in t.fixtures {
    if f.tool.length() == 0 ||
      f.tool.length() > 120 ||
      f.args_key.length() > 4000 ||
      f.result.length() > 8000 {
      errors.push(violation(-1, "fixture", "SCHEMA", "Invalid fixture bounds"))
    }
    for j = 0; j < i; j = j + 1 {
      let other = t.fixtures[j]
      if f.tool == other.tool && f.args_key == other.args_key {
        errors.push(
          violation(-1, "fixture", "SCHEMA", "Duplicate tool/argument fixture"),
        )
      }
    }
  }
  errors
}

///|
/// Offline historical trace audit. It does not execute or intercept tools.
fn evaluate(t : Tape) -> Report {
  let violations = shape_errors(t)
  let replay : Array[ReplayStep] = []
  if violations.length() > 0 {
    return {
      ok: false,
      calls: 0,
      total_cost: 0,
      violations,
      replay,
      network_calls: 0,
      engine: "MoonBit AgentTape 0.1",
    }
  }
  let approvals : Array[Event] = []
  let used_approvals : Array[String] = []
  let executed : Array[String] = []
  let mut total = 0
  let mut calls = 0
  for i, e in t.events {
    if e.kind == "approve" {
      if has(executed, e.target) {
        violations.push(
          violation(
            i,
            e.id,
            "LATE_APPROVAL",
            "Approval arrived after the target call",
          ),
        )
      }
      approvals.push(e)
      continue
    }
    calls = calls + 1
    total = total + e.cost
    executed.push(e.id)
    if !has(t.policy.allowed_tools, e.tool) {
      violations.push(
        violation(i, e.id, "TOOL_DENIED", "Tool is not on the allowlist"),
      )
    }
    if calls > t.policy.max_calls {
      violations.push(violation(i, e.id, "CALL_LIMIT", "Call count exceeded"))
    }
    if total > t.policy.max_total_cost {
      violations.push(
        violation(i, e.id, "BUDGET", "Cumulative recorded cost exceeded"),
      )
    }
    if has(t.policy.side_effect_tools, e.tool) {
      let mut approved = false
      for a in approvals {
        if a.target == e.id &&
          a.tool == e.tool &&
          a.args_key == e.args_key &&
          !has(used_approvals, a.id) &&
          !approved {
          approved = true
          used_approvals.push(a.id)
        }
      }
      if !approved {
        violations.push(
          violation(
            i,
            e.id,
            "APPROVAL_REQUIRED",
            "No prior approval for this call and exact arguments",
          ),
        )
      }
    }
    let mut found = false
    for f in t.fixtures {
      if f.tool == e.tool && f.args_key == e.args_key {
        found = true
        replay.push({
          step: i,
          event_id: e.id,
          tool: e.tool,
          result: f.result,
          source: "fixture",
        })
        if f.result != e.result {
          violations.push(
            violation(
              i,
              e.id,
              "RESULT_DRIFT",
              "Recorded result differs from fixture",
            ),
          )
        }
      }
    }
    if !found {
      violations.push(
        violation(
          i,
          e.id,
          "MISSING_FIXTURE",
          "No matching fixture; network fallback is forbidden",
        ),
      )
    }
  }
  {
    ok: violations.length() == 0,
    calls,
    total_cost: total,
    violations,
    replay,
    network_calls: 0,
    engine: "MoonBit AgentTape 0.1",
  }
}

///|
fn contains_code(t : Tape, code : String) -> Bool {
  let r = evaluate(t)
  for v in r.violations {
    if v.code == code {
      return true
    }
  }
  false
}

///| Greedy fixed-point reducer: preserves the first violation code.

///|
/// It produces a 1-minimal subsequence, not a globally shortest trace.
fn reduce_tape(t : Tape, code : String) -> Tape {
  let mut current = t
  let mut changed = true
  while changed {
    changed = false
    for drop = 0; drop < current.events.length(); drop = drop + 1 {
      let events : Array[Event] = []
      for i, e in current.events {
        if i != drop {
          events.push(e)
        }
      }
      let candidate = { ..current, events, }
      if contains_code(candidate, code) {
        current = candidate
        changed = true
        break
      }
    }
  }
  current
}

///|
pub fn evaluate_json(input : String) -> String {
  if input.length() > 200000 {
    return "{\"ok\":false,\"error\":\"INPUT_TOO_LARGE\"}"
  }
  try {
    let tape : Tape = @json.from_json(@json.parse(input))
    ToJson::to_json(evaluate(tape)).stringify()
  } catch {
    _ => "{\"ok\":false,\"error\":\"INVALID_JSON_OR_SCHEMA\"}"
  }
}

///|
struct Reduced {
  target_code : String
  before : Int
  after : Int
  guarantee : String
  tape : Tape
  report : Report
} derive(ToJson)

///|
pub fn minimize_json(input : String) -> String {
  if input.length() > 200000 {
    return "{\"ok\":false,\"error\":\"INPUT_TOO_LARGE\"}"
  }
  try {
    let tape : Tape = @json.from_json(@json.parse(input))
    if tape.events.length() > 60 {
      return "{\"ok\":false,\"error\":\"REDUCTION_LIMIT_60_EVENTS\"}"
    }
    let report = evaluate(tape)
    if report.ok {
      return "{\"ok\":true,\"message\":\"NO_VIOLATION\"}"
    }
    let code = report.violations[0].code
    if code == "SCHEMA" || code == "LIMIT" {
      return "{\"ok\":false,\"error\":\"FIX_SCHEMA_BEFORE_REDUCTION\"}"
    }
    let reduced = reduce_tape(tape, code)
    let output : Reduced = {
      target_code: code,
      before: tape.events.length(),
      after: reduced.events.length(),
      guarantee: "1-minimal for the same violation code; not globally shortest or same causal bug",
      tape: reduced,
      report: evaluate(reduced),
    }
    ToJson::to_json(output).stringify()
  } catch {
    _ => "{\"ok\":false,\"error\":\"INVALID_JSON_OR_SCHEMA\"}"
  }
}

///|
fn main {
  // Browser and CLI hosts call the two exported string-to-string functions.
}

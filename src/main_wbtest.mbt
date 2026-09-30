///|
fn example(approved : Bool) -> Tape {
  let events : Array[Event] = []
  events.push({
    id: "read1",
    kind: "call",
    tool: "search",
    args_key: "topic=demo",
    cost: 2,
    result: "found",
    target: "",
  })
  if approved {
    events.push({
      id: "a1",
      kind: "approve",
      tool: "send",
      args_key: "recipient=demo",
      cost: 0,
      result: "",
      target: "send1",
    })
  }
  events.push({
    id: "send1",
    kind: "call",
    tool: "send",
    args_key: "recipient=demo",
    cost: 3,
    result: "sent",
    target: "",
  })
  {
    version: 1,
    policy: {
      allowed_tools: ["search", "send"],
      side_effect_tools: ["send"],
      max_total_cost: 10,
      max_calls: 10,
    },
    fixtures: [
      { tool: "search", args_key: "topic=demo", result: "found", },
      { tool: "send", args_key: "recipient=demo", result: "sent", },
    ],
    events,
  }
}

///|
test "approved trace replays without any network" {
  let r = evaluate(example(true))
  assert_true(r.ok)
  assert_eq(r.network_calls, 0)
  assert_eq(r.total_cost, 5)
  assert_eq(r.replay.length(), 2)
}

///|
test "missing approval and irreducible witness" {
  let t = example(false)
  assert_true(contains_code(t, "APPROVAL_REQUIRED"))
  let reduced = reduce_tape(t, "APPROVAL_REQUIRED")
  assert_eq(reduced.events.length(), 1)
  assert_eq(reduced.events[0].id, "send1")
}

///|
test "approval binds exact arguments" {
  let t = example(true)
  let events = t.events.copy()
  events[1] = { ..events[1], args_key: "recipient=someone-else", }
  assert_true(contains_code({ ..t, events, }, "APPROVAL_REQUIRED"))
}

///|
test "future approval never authorizes past call" {
  let t = example(true)
  let events = [t.events[0], t.events[2], t.events[1]]
  assert_true(contains_code({ ..t, events, }, "APPROVAL_REQUIRED"))
  assert_true(contains_code({ ..t, events, }, "LATE_APPROVAL"))
}

///|
test "budget boundary counts all recorded calls" {
  let t = example(true)
  assert_true(evaluate({ ..t, policy: { ..t.policy, max_total_cost: 5, }, }).ok)
  assert_true(
    contains_code(
      { ..t, policy: { ..t.policy, max_total_cost: 4, }, },
      "BUDGET",
    ),
  )
}

///|
test "missing fixture never silently executes live tool" {
  let t = example(true)
  assert_true(contains_code({ ..t, fixtures: [], }, "MISSING_FIXTURE"))
  assert_eq(evaluate({ ..t, fixtures: [], }).network_calls, 0)
}

///|
test "drift detects changed response" {
  let t = example(true)
  let events = t.events.copy()
  events[0] = { ..events[0], result: "changed", }
  assert_true(contains_code({ ..t, events, }, "RESULT_DRIFT"))
}

///|
test "unknown tools and call limit" {
  let t = example(true)
  let p = { ..t.policy, allowed_tools: ["search"], max_calls: 1, }
  assert_true(contains_code({ ..t, policy: p, }, "TOOL_DENIED"))
  assert_true(contains_code({ ..t, policy: p, }, "CALL_LIMIT"))
}

///|
test "negative cost is invalid rather than budget credit" {
  let t = example(true)
  let events = t.events.copy()
  events[0] = { ..events[0], cost: -20, }
  assert_true(contains_code({ ..t, events, }, "SCHEMA"))
}

///|
test "duplicate fixture and duplicate id are invalid" {
  let t = example(true)
  assert_true(
    contains_code({ ..t, fixtures: [t.fixtures[0], t.fixtures[0]], }, "SCHEMA"),
  )
  assert_true(
    contains_code({ ..t, events: [t.events[0], t.events[0]], }, "SCHEMA"),
  )
}

///|
test "JSON boundary rejects malformed input" {
  assert_eq(
    evaluate_json("no json"),
    "{\"ok\":false,\"error\":\"INVALID_JSON_OR_SCHEMA\"}",
  )
  assert_eq(
    evaluate_json("{}"),
    "{\"ok\":false,\"error\":\"INVALID_JSON_OR_SCHEMA\"}",
  )
}

///|
test "stable JSON report and reducer fixed point" {
  let t = example(false)
  let raw = ToJson::to_json(t).stringify()
  assert_eq(evaluate_json(raw), evaluate_json(raw))
  let r = reduce_tape(t, "APPROVAL_REQUIRED")
  assert_eq(
    ToJson::to_json(r).stringify(),
    ToJson::to_json(reduce_tape(r, "APPROVAL_REQUIRED")).stringify(),
  )
}

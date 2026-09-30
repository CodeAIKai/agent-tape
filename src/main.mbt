///|
/// Browser and Node bindings delegate to the reusable MoonBit package.
pub fn evaluate_json(input : String) -> String {
  @core.evaluate_json(input)
}

///|
pub fn minimize_json(input : String) -> String {
  @core.minimize_json(input)
}

///|
pub fn minimize_target_json(
  input : String,
  code : String,
  event_id : String,
) -> String {
  @core.minimize_target_json(input, code, event_id)
}

///|
fn main {

}

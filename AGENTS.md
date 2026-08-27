# Agent instructions

## Code style

### Comments

Do not write comments inside a method body. Anything worth explaining belongs in the TSDoc of the
method, the type or the field it is about - in the C# code, in the XML documentation of the member,
using `<remarks>` for what does not fit the summary.

A comment inside a method is invisible to whoever reads the method from the outside, is not carried
over when the method is called from somewhere else, and drifts out of place as the body is edited.
The documentation of the member it belongs to is read by anyone who uses it, shows up on hover and
stays attached to what it describes.

When the explanation is about one specific line rather than the method as a whole, that is usually a
sign that the line should be its own well named method, documented as such.

This does not apply to test files, where the `describe`/`it` description is what documents the test
and a comment is the only place left to say why an expectation is what it is.

### Tests

Do not replace a module with `vi.mock("some-package", ...)`, and do not build a stand-in for a third
party plugin with `vi.hoisted`. A module mock swaps the real thing out for the whole file, so the test
stops exercising the code that talks to that dependency and starts exercising a hand written imitation
of it. It keeps passing when the real plugin changes its behaviour, its event names or its arguments,
which is exactly when a test is supposed to fail.

Test through the seams the app already has instead: a service that is injected can be given a stand-in
through the test bed, an object the app owns can be spied on, and the part of the method that does not
need the plugin can be tested on its own. Whatever is left - the code that only runs against the real
native plugin - is covered by running the app on a device, not by asserting against an imitation.

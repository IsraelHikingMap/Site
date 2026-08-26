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

# 🌌 @a-type/react-space

An attempt to extract a generic 2d spatial canvas primitive in React.

I keep re-inventing 2D canvas primitives. I feel like I've gotten pretty decent at it, but it's a hard problem to abstract well.

This is my first attempt at a general-purpose 2D "infinite" canvas abstraction. "Infinite" in quotes because it's not logically infinite, it's in fact capped, the cap can just be very very high without performance impact (afaik).

`pnpm add @a-type/react-space`

See `./src/stories` for working examples. Not going to attempt to document here until the usage is stable.

Unlike other 2D canvas that I know of, this library automatically tracks the size of object elements within the canvas, so it's much easier to do things like intersection queries. Included out of the box is a `<BoxSelect />` component, too. The main `Canvas` has a `selections` property which tracks selected objects by ID. So, the library is kind of opinionated about some common concepts. This may prove to be unfortunate for general usage, but tbh this is mostly for me, anyway.

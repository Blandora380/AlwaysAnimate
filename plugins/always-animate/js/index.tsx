import { before } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'

const KEYS = ['animate', 'animateAvatar', 'animateEmoji', 'canAnimate', 'shouldAnimate']
const TARGET = /avatar|banner|emoji|nameplate/i

function nameOf(type: any): string {
    return (
        type?.displayName ||
        type?.name ||
        type?.type?.name ||
        type?.render?.name ||
        ''
    )
}

function force<T>(args: T): T {
    const [type, props, key] = args as any[]
    if (typeof type === 'string' || !props) return args

    let next: Record<string, unknown> | undefined
    for (const k of KEYS) {
        if (props[k] === false) (next ??= { ...props })[k] = true
    }

    if (!next || !TARGET.test(nameOf(type))) return args
    return [type, next, key] as unknown as T
}

export default plugin({
    start({ cleanup }) {
        cleanup(
            before(ReactJSXRuntime, 'jsx', force),
            before(ReactJSXRuntime, 'jsxs', force),
        )
    },
})

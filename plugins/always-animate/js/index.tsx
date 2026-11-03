import { before } from '@valenced/patcher'
import { insteadJSX } from '@valenced/react/jsx-runtime'
import { ReactJSXRuntime } from '@valenced/react'
import { useEffect, useState } from 'react'
import { Text } from 'react-native'

const KEYS = ['animate', 'animateAvatar', 'animateEmoji', 'canAnimate', 'shouldAnimate']
const TARGET = /avatar|banner|emoji|nameplate|profileeffect|guildicon/i

const listeners = new Set<() => void>()
let offset = 0
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(fn: () => void) {
    listeners.add(fn)
    if (!timer) {
        timer = setInterval(() => {
            offset = (offset + 0.012) % 1
            listeners.forEach(l => l())
        }, 60)
    }
    return () => {
        listeners.delete(fn)
        if (!listeners.size && timer) {
            clearInterval(timer)
            timer = undefined
        }
    }
}

function split(c: number) {
    const u = c >>> 0
    return [(u >>> 24) & 255, (u >>> 16) & 255, (u >>> 8) & 255, u & 255]
}

function join(p: number[]) {
    return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) | 0
}

function shifted(colors: number[], t: number): number[] {
    const closed = colors.length > 2 && colors[0] === colors[colors.length - 1]
    const loop = (closed ? colors.slice(0, -1) : colors).map(split)
    const n = loop.length
    return colors.map((_, k) => {
        const pos = (((k / (colors.length - 1) + t) % 1) + 1) % 1 * n
        const i = Math.floor(pos)
        const f = pos - i
        const a = loop[i % n]
        const b = loop[(i + 1) % n]
        return join(a.map((v, j) => Math.round(v + (b[j] - v) * f)))
    })
}

function AnimatedGradientText(props: any) {
    const [, setTick] = useState(0)
    useEffect(() => subscribe(() => setTick(x => x + 1)), [])
    return <Text {...props} gradientColors={shifted(props.gradientColors, offset)} __aa />
}

function nameOf(type: any): string {
    return type?.displayName || type?.name || type?.type?.name || type?.render?.name || ''
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
            insteadJSX(Text as any, ([type, props, key]: any[], jsx: any) => {
                if (props?.__aa) {
                    const { __aa, ...rest } = props
                    return jsx(type, rest, key)
                }
                const c = props?.gradientColors
                if (Array.isArray(c) && c.length > 1 && c.every(x => typeof x === 'number')) {
                    return jsx(AnimatedGradientText, props, key)
                }
                return jsx(type, props, key)
            }),
        )
    },
})

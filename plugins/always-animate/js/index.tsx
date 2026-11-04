import { before } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'
import { createElement, useEffect, useState } from 'react'

const KEYS = ['animate', 'animateAvatar', 'animateEmoji', 'canAnimate', 'shouldAnimate']
const TARGET = /avatar|banner|emoji|nameplate|profileeffect|guildicon/i
const HEX = /^#[0-9a-f]{6}$/i

function makeClock(ms: number, step: number) {
    const listeners = new Set<() => void>()
    let offset = 0
    let timer: ReturnType<typeof setInterval> | undefined
    return {
        get offset() {
            return offset
        },
        subscribe(fn: () => void) {
            listeners.add(fn)
            if (!timer) {
                timer = setInterval(() => {
                    offset = (offset + step) % 1
                    listeners.forEach(l => l())
                }, ms)
            }
            return () => {
                listeners.delete(fn)
                if (!listeners.size && timer) {
                    clearInterval(timer)
                    timer = undefined
                }
            }
        },
    }
}

const fast = makeClock(60, 0.012)
const slow = makeClock(200, 0.02)
const wrappers = new Map<any, any>()
const chatWrappers = new Map<any, any>()

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
        const pos = ((((k / (colors.length - 1) + t) % 1) + 1) % 1) * n
        const i = Math.floor(pos)
        const f = pos - i
        const a = loop[i % n]
        const b = loop[(i + 1) % n]
        return join(a.map((v, j) => Math.round(v + (b[j] - v) * f)))
    })
}

function hexRgb(s: string) {
    return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16))
}

function rgbHex(p: number[]) {
    return '#' + p.map(v => v.toString(16).padStart(2, '0')).join('')
}

function rotateHex(stops: string[], t: number): string[] {
    const n = stops.length
    const rgb = stops.map(hexRgb)
    return stops.map((_, k) => {
        const pos = (k + t * n) % n
        const i = Math.floor(pos)
        const f = pos - i
        const a = rgb[i % n]
        const b = rgb[(i + 1) % n]
        return rgbHex(a.map((v, j) => Math.round(v + (b[j] - v) * f)))
    })
}

function recolor(m: any, t: number) {
    const cs = m?.colorStrings
    if (!cs) return m
    const stops = [cs.primaryColor, cs.secondaryColor, cs.tertiaryColor].filter(
        (c: any) => typeof c === 'string' && HEX.test(c),
    )
    if (stops.length < 2) return m
    const out = rotateHex(stops, t)
    return {
        ...m,
        colorString: out[0],
        colorStrings: {
            primaryColor: out[0],
            secondaryColor: out[1],
            tertiaryColor: stops.length > 2 ? out[2] : cs.tertiaryColor,
        },
    }
}

function gradientWrapper(type: any) {
    let w = wrappers.get(type)
    if (!w) {
        w = function AnimatedGradient(props: any) {
            const [, setTick] = useState(0)
            useEffect(() => fast.subscribe(() => setTick(x => x + 1)), [])
            return createElement(type, {
                ...props,
                gradientColors: shifted(props.gradientColors, fast.offset),
            })
        }
        wrappers.set(type, w)
    }
    return w
}

function chatWrapper(type: any) {
    let w = chatWrappers.get(type)
    if (!w) {
        w = function AnimatedChat(props: any) {
            const [, setTick] = useState(0)
            useEffect(() => slow.subscribe(() => setTick(x => x + 1)), [])
            const members = props.messageAuthorMembers
            if (!members) return createElement(type, props)
            const next: Record<string, unknown> = {}
            for (const id in members) next[id] = recolor(members[id], slow.offset)
            return createElement(type, { ...props, messageAuthorMembers: next })
        }
        chatWrappers.set(type, w)
    }
    return w
}

function isGradient(props: any) {
    const c = props?.gradientColors
    return Array.isArray(c) && c.length > 1 && c.every((x: any) => typeof x === 'number')
}

function nameOf(type: any): string {
    return type?.displayName || type?.name || type?.type?.name || type?.render?.name || ''
}

function force<T>(args: T): T {
    const [type, props, key] = args as any[]
    if (!props) return args

    if (isGradient(props)) return [gradientWrapper(type), props, key] as unknown as T
    if (typeof type === 'string') return args

    const name = nameOf(type)
    if (name === 'MessagesRenderer' && props.messageAuthorMembers) {
        return [chatWrapper(type), props, key] as unknown as T
    }

    let next: Record<string, unknown> | undefined
    for (const k of KEYS) {
        if (props[k] === false) (next ??= { ...props })[k] = true
    }

    if (!next || !TARGET.test(name)) return args
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

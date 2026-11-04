import { before } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'
import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

const RADII = [8, 16, 24]
const DURATIONS = [150, 250, 400]

const cfg = { radius: 8, ms: 150, header: true, pauseGifs: true }

let active = 0
let progress = 0
let from = 0
let target = 0
let startAt = 0
let raf: number | undefined

const frameListeners = new Set<() => void>()
const stateListeners = new Set<() => void>()
const scopeWrappers = new Map<any, any>()
const blurWrappers = new Map<any, any>()
const pauseWrappers = new Map<any, any>()

function frame(now: number) {
    raf = undefined
    if (!startAt) startAt = now
    const t = Math.min(1, (now - startAt) / cfg.ms)
    progress = from + (target - from) * (t * t * (3 - 2 * t))
    frameListeners.forEach(l => l())
    if (t < 1) raf = requestAnimationFrame(frame)
}

function setGoal(g: number) {
    if (g === target) return
    from = progress
    target = g
    startAt = 0
    if (raf === undefined) raf = requestAnimationFrame(frame)
}

function nameOf(type: any): string {
    return type?.displayName || type?.name || type?.type?.name || type?.render?.name || ''
}

function isMessageSheet(props: any) {
    return !!props.message && !!props.channel && 'canAddNewReactions' in props && 'chatInputRef' in props
}

function scopeFor(type: any) {
    let w = scopeWrappers.get(type)
    if (!w) {
        w = function MessageSheetScope(props: any) {
            const started = useRef(false)
            if (!started.current) {
                started.current = true
                active++
                if (active === 1) stateListeners.forEach(l => l())
                setGoal(1)
            }
            useEffect(
                () => () => {
                    active = Math.max(0, active - 1)
                    if (!active) {
                        setGoal(0)
                        stateListeners.forEach(l => l())
                    }
                },
                [],
            )
            return createElement(type, props)
        }
        scopeWrappers.set(type, w)
    }
    return w
}

function blurFor(type: any, flex: boolean) {
    let w = blurWrappers.get(type)
    if (!w) {
        w = function Blurred(props: any) {
            const [, setTick] = useState(0)
            useEffect(() => {
                const fn = () => setTick(x => x + 1)
                frameListeners.add(fn)
                return () => {
                    frameListeners.delete(fn)
                }
            }, [])
            const child = useMemo(() => createElement(type, props), [props])
            const amount = cfg.radius * progress
            let style: any = flex ? { flex: 1 } : undefined
            if (amount > 0.1) style = { ...style, filter: [{ blur: amount }] }
            return createElement(View, { style }, child)
        }
        blurWrappers.set(type, w)
    }
    return w
}

function pauseFor(type: any) {
    let w = pauseWrappers.get(type)
    if (!w) {
        w = function PauseGifs(props: any) {
            const [open, setOpen] = useState(active > 0)
            useEffect(() => {
                const fn = () => setOpen(active > 0)
                stateListeners.add(fn)
                return () => {
                    stateListeners.delete(fn)
                }
            }, [])
            return createElement(type, open && cfg.pauseGifs ? { ...props, gifAutoPlay: false } : props)
        }
        pauseWrappers.set(type, w)
    }
    return w
}

function force<T>(args: T): T {
    const [type, props, key] = args as any[]
    if (typeof type === 'string' || !props) return args
    if (isMessageSheet(props)) return [scopeFor(type), props, key] as unknown as T
    const name = nameOf(type)
    if (name === 'ChatView') return [blurFor(type, true), props, key] as unknown as T
    if (name === 'Header' && cfg.header) return [blurFor(type, false), props, key] as unknown as T
    if (name === 'MessagesRenderer' && 'gifAutoPlay' in props) {
        return [pauseFor(type), props, key] as unknown as T
    }
    return args
}

function Choice({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
    return (
        <Pressable onPress={onPress}>
            <Text style={{ color: on ? '#7ee787' : '#fff', paddingHorizontal: 16, paddingVertical: 10 }}>
                {on ? '● ' : '○ '}
                {label}
            </Text>
        </Pressable>
    )
}

export default plugin({
    start({ cleanup }) {
        cleanup(
            before(ReactJSXRuntime, 'jsx', force),
            before(ReactJSXRuntime, 'jsxs', force),
        )
    },
    SettingsComponent() {
        const [, setTick] = useState(0)
        const refresh = () => setTick(x => x + 1)
        const head = { color: '#fff', padding: 16, fontWeight: '700' as const }
        return (
            <ScrollView>
                <Text style={head}>Kekuatan blur</Text>
                {RADII.map(r => (
                    <Choice key={r} on={cfg.radius === r} label={String(r)} onPress={() => { cfg.radius = r; refresh() }} />
                ))}
                <Text style={head}>Durasi transisi (ms)</Text>
                {DURATIONS.map(d => (
                    <Choice key={d} on={cfg.ms === d} label={String(d)} onPress={() => { cfg.ms = d; refresh() }} />
                ))}
                <Text style={head}>Lainnya</Text>
                <Choice on={cfg.header} label="Blur top bar" onPress={() => { cfg.header = !cfg.header; refresh() }} />
                <Choice on={cfg.pauseGifs} label="Hentikan GIF saat sheet terbuka" onPress={() => { cfg.pauseGifs = !cfg.pauseGifs; refresh() }} />
            </ScrollView>
        )
    },
})

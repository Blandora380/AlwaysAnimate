import { before } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'
import { createElement, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

const RADII = [8, 16, 24]
const DURATIONS = [150, 250, 400]
const CANDIDATES = ['ChatView', 'ChannelHeader', 'GuildChannelHeader', 'Header', 'ChatViewWrapperBase']
const FLEX = new Set(['ChatView', 'ChatViewWrapperBase'])

const cfg = {
    radius: 16,
    ms: 250,
    targets: new Set(['ChatView', 'ChannelHeader', 'GuildChannelHeader']),
}

let active = 0
let progress = 0
let goal = 0
let timer: ReturnType<typeof setInterval> | undefined

const listeners = new Set<() => void>()
const scopeWrappers = new Map<any, any>()
const blurWrappers = new Map<any, any>()
const counts = new Map<string, number>()
const status = { sheets: 0 }

function tick() {
    const step = 16 / cfg.ms
    progress = goal > progress ? Math.min(goal, progress + step) : Math.max(goal, progress - step)
    listeners.forEach(l => l())
    if (progress === goal && timer) {
        clearInterval(timer)
        timer = undefined
    }
}

function setGoal(g: number) {
    goal = g
    if (!timer && progress !== goal) timer = setInterval(tick, 16)
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
            useEffect(() => {
                active++
                status.sheets++
                setGoal(1)
                return () => {
                    active = Math.max(0, active - 1)
                    if (!active) setGoal(0)
                }
            }, [])
            return createElement(type, props)
        }
        scopeWrappers.set(type, w)
    }
    return w
}

function blurFor(type: any, name: string) {
    let w = blurWrappers.get(type)
    if (!w) {
        const flex = FLEX.has(name)
        w = function Blurred(props: any) {
            const [, setTick] = useState(0)
            useEffect(() => {
                const fn = () => setTick(x => x + 1)
                listeners.add(fn)
                return () => {
                    listeners.delete(fn)
                }
            }, [])
            counts.set(name, (counts.get(name) ?? 0) + 1)
            const child = useMemo(() => createElement(type, props), [props])
            const amount = cfg.radius * (1 - Math.pow(1 - progress, 3))
            let style: any = flex ? { flex: 1 } : undefined
            if (amount > 0.1) style = { ...style, filter: [{ blur: amount }] }
            return createElement(View, { style }, child)
        }
        blurWrappers.set(type, w)
    }
    return w
}

function force<T>(args: T): T {
    const [type, props, key] = args as any[]
    if (typeof type === 'string' || !props) return args
    if (isMessageSheet(props)) return [scopeFor(type), props, key] as unknown as T
    const name = nameOf(type)
    if (cfg.targets.has(name)) return [blurFor(type, name), props, key] as unknown as T
    return args
}

function Choice({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
    return (
        <Pressable onPress={onPress}>
            <Text
                style={{
                    color: on ? '#7ee787' : '#fff',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                }}
            >
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
                <Text style={head}>Komponen yang di-blur</Text>
                {CANDIDATES.map(c => (
                    <Choice
                        key={c}
                        on={cfg.targets.has(c)}
                        label={`${c} (render: ${counts.get(c) ?? 0})`}
                        onPress={() => {
                            if (cfg.targets.has(c)) cfg.targets.delete(c)
                            else cfg.targets.add(c)
                            refresh()
                        }}
                    />
                ))}
                <Text style={{ color: '#fff', padding: 16 }}>
                    {`sheetTerdeteksi=${status.sheets}`}
                </Text>
            </ScrollView>
        )
    },
})

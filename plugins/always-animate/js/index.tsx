import { before } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'
import { ScrollView, Text } from 'react-native'

const KEYS = ['animate', 'animateAvatar', 'animateEmoji', 'canAnimate', 'shouldAnimate']
const TARGET = /avatar|banner|emoji|nameplate/i
const WATCH = /animat|gradient|enhanced|effect|loop|displayNameStyle/i
const SKIP = /screen|reanimated|animated|pressable/i

const seen = new Map<string, Set<string>>()

function nameOf(type: any): string {
    return (
        type?.displayName ||
        type?.name ||
        type?.type?.name ||
        type?.render?.name ||
        ''
    )
}

function fmt(v: any): string {
    if (v === null || typeof v !== 'object') {
        return typeof v === 'function' ? 'fn' : String(v)
    }
    try {
        return JSON.stringify(v).slice(0, 120)
    } catch {
        return 'obj'
    }
}

function record(name: string, props: any) {
    if (!name || SKIP.test(name)) return
    for (const k in props) {
        if (!WATCH.test(k)) continue
        let keys = seen.get(name)
        if (!keys) seen.set(name, (keys = new Set()))
        if (keys.size >= 8) continue
        keys.add(`${k}=${fmt(props[k])}`)
    }
}

function force<T>(args: T): T {
    const [type, props, key] = args as any[]
    if (typeof type === 'string' || !props) return args

    const name = nameOf(type)
    record(name, props)

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
    SettingsComponent() {
        const lines = [...seen].map(([n, k]) => `${n}: ${[...k].join(' | ')}`)
        return (
            <ScrollView>
                <Text selectable style={{ color: '#fff', padding: 16 }}>
                    {lines.join('\n\n') || 'Nothing yet. Browse Discord, then reopen.'}
                </Text>
            </ScrollView>
        )
    },
})

import { before } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'
import { ScrollView, Text } from 'react-native'

const KEYS = ['animate', 'animateAvatar', 'animateEmoji', 'canAnimate', 'shouldAnimate']
const TARGET = /avatar|banner|emoji|nameplate/i
const NAMEISH = /displayname|username|rolename|member|role|effect/i

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

function record(name: string, props: any) {
    let entries = seen.get(name)
    if (!entries) seen.set(name, (entries = new Set()))
    for (const k in props) {
        if (k === 'children' || k === 'style') continue
        if (entries.size >= 24) return
        const v = props[k]
        entries.add(
            typeof v === 'boolean' || typeof v === 'number' ? `${k}=${v}` : k,
        )
    }
}

function force<T>(args: T): T {
    const [type, props, key] = args as any[]
    if (typeof type === 'string' || !props) return args

    const name = nameOf(type)
    if (name === 'Text' && props.gradientColors) record('Text(gradient)', props)
    else if (NAMEISH.test(name)) record(name, props)

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

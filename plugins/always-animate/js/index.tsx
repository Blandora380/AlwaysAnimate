import { before } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'
import { ScrollView, Text } from 'react-native'

const seen = new Map<string, Set<string>>()

function nameOf(type: any): string {
    return (
        type?.displayName ||
        type?.name ||
        type?.type?.name ||
        type?.render?.name ||
        String(type?.$$typeof ?? typeof type)
    )
}

function scan<T>(args: T): T {
    const [type, props] = args as any[]
    if (typeof type === 'string' || !props) return args
    for (const key in props) {
        if (!/animat/i.test(key)) continue
        const name = nameOf(type)
        let keys = seen.get(name)
        if (!keys) seen.set(name, (keys = new Set()))
        keys.add(`${key}=${String(props[key])}`)
    }
    return args
}

export default plugin({
    start({ cleanup }) {
        cleanup(
            before(ReactJSXRuntime, 'jsx', scan),
            before(ReactJSXRuntime, 'jsxs', scan),
        )
    },
    SettingsComponent() {
        const lines = [...seen].map(([n, k]) => `${n}: ${[...k].join(', ')}`)
        return (
            <ScrollView>
                <Text selectable style={{ color: '#fff', padding: 16 }}>
                    {lines.join('\n') || 'Nothing yet. Browse Discord, then reopen.'}
                </Text>
            </ScrollView>
        )
    },
})

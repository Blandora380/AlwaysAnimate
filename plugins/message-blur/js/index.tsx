import { before } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'
import { ScrollView, Text } from 'react-native'

const NAME = /sheet|longpress|messageaction|quickreact|reactionpicker|backdrop|blur/i
const seen = new Map<string, Set<string>>()

function nameOf(type: any): string {
    return type?.displayName || type?.name || type?.type?.name || type?.render?.name || ''
}

function scan<T>(args: T): T {
    const [type, props] = args as any[]
    if (typeof type === 'string' || !props) return args
    const name = nameOf(type)
    if (!name || !(NAME.test(name) || (props.message && props.channel))) return args
    let keys = seen.get(name)
    if (!keys) {
        if (seen.size > 80) return args
        seen.set(name, (keys = new Set()))
    }
    for (const k in props) if (k !== 'children' && keys.size < 30) keys.add(k)
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
        const lines = [...seen].map(([n, k]) => `${n}: ${[...k].join(' | ')}`)
        return (
            <ScrollView>
                <Text selectable style={{ color: '#fff', padding: 16 }}>
                    {lines.join('\n\n') || 'Belum ada. Hold satu pesan, lalu buka lagi.'}
                </Text>
            </ScrollView>
        )
    },
})

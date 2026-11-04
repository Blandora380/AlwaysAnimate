import { before } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'
import { createElement, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Text } from 'react-native'

const OPTIONS = [
    'light',
    'dark',
    'regular',
    'prominent',
    'xlight',
    'extraLight',
    'material',
    'thinMaterial',
    'thickMaterial',
    'ultraThinMaterial',
    'chromeMaterial',
    'systemMaterial',
]

let chosen = 'light'
let active = 0
const wrappers = new Map<any, any>()
const info = new Map<string, string>()

function nameOf(type: any): string {
    return type?.displayName || type?.name || type?.type?.name || type?.render?.name || ''
}

function isMessageSheet(props: any) {
    return !!props.message && !!props.channel && 'canAddNewReactions' in props && 'chatInputRef' in props
}

function scoped(type: any) {
    let w = wrappers.get(type)
    if (!w) {
        w = function MessageSheetScope(props: any) {
            const counted = useRef(false)
            if (!counted.current) {
                counted.current = true
                active++
            }
            useEffect(
                () => () => {
                    active = Math.max(0, active - 1)
                },
                [],
            )
            return createElement(type, props)
        }
        wrappers.set(type, w)
    }
    return w
}

function force<T>(args: T): T {
    const [type, props, key] = args as any[]
    if (typeof type === 'string' || !props) return args

    if (isMessageSheet(props)) return [scoped(type), props, key] as unknown as T

    if (active > 0 && 'blur' in props && nameOf(type) === 'Backdrop') {
        info.set('original', `${typeof props.blur} ${String(props.blur)}`)
        info.set('style', JSON.stringify(props.style ?? null).slice(0, 160))
        info.set('applied', chosen)
        return [type, { ...props, blur: chosen }, key] as unknown as T
    }

    return args
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
        return (
            <ScrollView>
                <Text style={{ color: '#fff', padding: 16 }}>
                    Pilih nilai, lalu hold satu pesan.
                </Text>
                {OPTIONS.map(o => (
                    <Pressable
                        key={o}
                        onPress={() => {
                            chosen = o
                            setTick(x => x + 1)
                        }}
                    >
                        <Text
                            style={{
                                color: chosen === o ? '#7ee787' : '#fff',
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                            }}
                        >
                            {chosen === o ? '● ' : '○ '}
                            {o}
                        </Text>
                    </Pressable>
                ))}
                <Text selectable style={{ color: '#fff', padding: 16 }}>
                    {[...info].map(([k, v]) => `${k}: ${v}`).join('\n')}
                </Text>
            </ScrollView>
        )
    },
})

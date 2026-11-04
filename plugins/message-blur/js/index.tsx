import { before } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'
import { createElement, useEffect, useRef } from 'react'
import { ScrollView, Text } from 'react-native'

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

    if (isMessageSheet(props)) {
        if (!info.has('message.keys')) {
            info.set('message.keys', Object.keys(props.message).join(' | '))
            info.set('user.keys', Object.keys(props.user ?? {}).join(' | '))
        }
        return [scoped(type), props, key] as unknown as T
    }

    if (active > 0 && 'blur' in props && nameOf(type) === 'Backdrop') {
        info.set('Backdrop.blur(original)', `${typeof props.blur} ${String(props.blur)}`)
        return [type, { ...props, blur: true }, key] as unknown as T
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
        const lines = [...info].map(([k, v]) => `${k}: ${v}`)
        return (
            <ScrollView>
                <Text selectable style={{ color: '#fff', padding: 16 }}>
                    {lines.join('\n\n') || 'Belum ada. Hold satu pesan, lalu buka lagi.'}
                </Text>
            </ScrollView>
        )
    },
})

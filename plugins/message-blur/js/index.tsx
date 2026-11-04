import { before } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'
import { createElement, useEffect, useRef, useState } from 'react'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'

const RADII = [4, 8, 16, 24]

let radius = 16
let active = 0
const listeners = new Set<() => void>()
const scopeWrappers = new Map<any, any>()
const blurWrappers = new Map<any, any>()
const status = { sheets: 0, chatViewRenders: 0 }

function notify() {
    listeners.forEach(l => l())
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
                notify()
                return () => {
                    active = Math.max(0, active - 1)
                    notify()
                }
            }, [])
            return createElement(type, props)
        }
        scopeWrappers.set(type, w)
    }
    return w
}

function blurFor(type: any) {
    let w = blurWrappers.get(type)
    if (!w) {
        w = function BlurredChat(props: any) {
            const [on, setOn] = useState(active > 0)
            const r = useRef(radius)
            r.current = radius
            useEffect(() => {
                const fn = () => setOn(active > 0)
                listeners.add(fn)
                fn()
                return () => {
                    listeners.delete(fn)
                }
            }, [])
            status.chatViewRenders++
            const style: any = on ? { flex: 1, filter: [{ blur: r.current }] } : { flex: 1 }
            return createElement(View, { style }, createElement(type, props))
        }
        blurWrappers.set(type, w)
    }
    return w
}

function force<T>(args: T): T {
    const [type, props, key] = args as any[]
    if (typeof type === 'string' || !props) return args
    if (isMessageSheet(props)) return [scopeFor(type), props, key] as unknown as T
    if (nameOf(type) === 'ChatView') return [blurFor(type), props, key] as unknown as T
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
                    Pilih kekuatan blur, lalu hold satu pesan.
                </Text>
                {RADII.map(r => (
                    <Pressable
                        key={r}
                        onPress={() => {
                            radius = r
                            setTick(x => x + 1)
                        }}
                    >
                        <Text
                            style={{
                                color: radius === r ? '#7ee787' : '#fff',
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                            }}
                        >
                            {radius === r ? '● ' : '○ '}
                            {r}
                        </Text>
                    </Pressable>
                ))}
                <Text selectable style={{ color: '#fff', padding: 16 }}>
                    {`os=${Platform.OS} api=${Platform.Version}\nsheetTerdeteksi=${status.sheets}\nchatViewRender=${status.chatViewRenders}`}
                </Text>
            </ScrollView>
        )
    },
})

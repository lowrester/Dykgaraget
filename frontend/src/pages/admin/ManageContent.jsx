import { useEffect, useState } from 'react'
import { useSettingsStore, useUIStore } from '../../store/index.js'
import { AdminLayout, Card, Spinner, Button, Alert } from '../../components/common/index.jsx'

export default function ManageContent() {
    const { settings, fetchSettings, updateSetting, loading } = useSettingsStore()
    const { addToast } = useUIStore()

    const [editKey, setEditKey] = useState(null)
    const [editValue, setEditValue] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const contentSettings = settings.filter(s => s.key.startsWith('content_'))

    // Group settings by their prefix (after content_)
    const groups = contentSettings.reduce((acc, s) => {
        const parts = s.key.split('_')
        const groupName = parts[1] || 'Övrigt'
        if (!acc[groupName]) acc[groupName] = []
        acc[groupName].push(s)
        return acc
    }, {})

    const startEdit = (key, value) => {
        setEditKey(key)
        setEditValue(value || '')
    }

    const cancelEdit = () => {
        setEditKey(null)
        setEditValue('')
    }

    const saveEdit = async () => {
        setSaving(true)
        try {
            await updateSetting(editKey, editValue)
            addToast('Innehåll uppdaterat!')
            cancelEdit()
        } catch (err) {
            addToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const groupLabels = {
        home: 'Hem-sidan',
        courses: 'Kurser-sidan',
        contact: 'Kontakt-sidan',
        common: 'Gemensamt'
    }

    return (
        <AdminLayout title="Hantera Innehåll">
            <p style={{ color: 'var(--gray-500)', marginBottom: '2rem' }}>
                Här kan du ändra texter och rubriker på de publika sidorna.
            </p>

            {loading && settings.length === 0 ? <Spinner /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {Object.entries(groups).map(([groupId, items]) => (
                        <Card key={groupId}>
                            <h2 style={{ marginBottom: '1rem', textTransform: 'capitalize' }}>
                                {groupLabels[groupId] || groupId}
                            </h2>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '30%' }}>Fält</th>
                                        <th>Innehåll</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(s => (
                                        <tr key={s.key}>
                                            <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                {s.description || s.key.replace('content_', '')}
                                            </td>
                                            <td>
                                                {editKey === s.key ? (
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                        <textarea
                                                            className="form-input"
                                                            style={{ marginBottom: 0, minHeight: '60px' }}
                                                            autoFocus
                                                            value={editValue}
                                                            onChange={e => setEditValue(e.target.value)}
                                                        />
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                            <Button size="sm" onClick={saveEdit} loading={saving}>Spara</Button>
                                                            <Button size="sm" variant="secondary" onClick={cancelEdit}>Avbryt</Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                                        <span style={{ fontSize: '0.9rem', color: 'var(--gray-700)', whiteSpace: 'pre-wrap' }}>
                                                            {s.value}
                                                        </span>
                                                        <button
                                                            className="btn btn-sm btn-ghost"
                                                            onClick={() => startEdit(s.key, s.value)}
                                                            style={{ marginLeft: 'auto', flexShrink: 0 }}
                                                        >
                                                            ✎ Ändra
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    ))}
                </div>
            )}
        </AdminLayout>
    )
}

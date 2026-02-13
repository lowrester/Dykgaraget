import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore, useCartStore, useSettingsStore, useUIStore } from '../../store/index.js'
import { Card, Button, Input, Alert, Spinner } from '../../components/common/index.jsx'
import client from '../../api/client.js'

export default function Checkout() {
    const { user } = useAuthStore()
    const { items, getTotals, clearCart, removeItem } = useCartStore()
    const { features } = useSettingsStore()
    const { addToast } = useUIStore()
    const navigate = useNavigate()

    const [form, setForm] = useState({
        first_name: user?.firstName || '',
        last_name: user?.lastName || '',
        email: user?.email || '',
        phone: '',
        address: '',
        zip: '',
        city: '',
        payment_method: 'invoice', // invoice or stripe
        gdprConsent: !!user
    })
    const [errors, setErrors] = useState({})
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(null)

    const totals = getTotals()

    useEffect(() => {
        if (items.length === 0 && !success) {
            navigate('/certifieringar')
        }
    }, [items, navigate, success])

    const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

    const validate = () => {
        const e = {}
        if (!form.first_name) e.first_name = 'Förnamn krävs'
        if (!form.last_name) e.last_name = 'Efternamn krävs'
        if (!form.email) e.email = 'E-post krävs'
        if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Ogiltig e-post'
        if (!form.gdprConsent) e.gdprConsent = 'Du måste godkänna integritetspolicyn'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!validate()) return

        setLoading(true)
        try {
            // Create order/bookings
            const orderData = {
                ...form,
                items,
                customer_id: user?.id || null,
                total_amount: totals.total
            }

            const response = await client.post('/orders', orderData)

            if (form.payment_method === 'stripe' && response.stripe_url) {
                window.location.href = response.stripe_url
                return
            }

            setSuccess(response)
            clearCart()
            addToast('Beställning genomförd!', 'success')
        } catch (err) {
            setErrors({ submit: err.message })
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        const inv = success.invoice
        const company = success.company
        return (
            <div className="page container">
                <div className="booking-success">
                    <div className="success-icon">✅</div>
                    <h1>Beställning slutförd!</h1>
                    <p>Tack {form.first_name}! Din beställning är nu registrerad.</p>

                    {inv ? (
                        <Card style={{ marginTop: '2rem', textAlign: 'left', border: '1px solid var(--blue-100)', background: 'var(--blue-50)' }}>
                            <h3 style={{ color: 'var(--blue-700)', marginBottom: '1rem' }}>Betalningsinformation (Faktura)</h3>
                            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Din faktura <strong>{inv.invoice_number}</strong> har skapats.</p>
                            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem', padding: '1rem', background: 'white', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Att betala:</span><strong>{parseFloat(inv.total_amount).toLocaleString('sv-SE')} kr</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bankgiro / Konto:</span><strong>{company?.bank_account || '—'}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ange referens:</span><strong>{inv.invoice_number}</strong></div>
                            </div>
                            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                                <a href={`/api/invoices/${inv.id}/pdf`} download className="btn btn-primary btn-sm">Ladda ner faktura (PDF)</a>
                            </div>
                        </Card>
                    ) : (
                        <Alert type="info" style={{ marginTop: '2rem' }}>En bekräftelse har skickats till <strong>{form.email}</strong>.</Alert>
                    )}

                    <div style={{ marginTop: '2rem' }}>
                        <Link to="/" className="btn btn-secondary">Tillbaka till hem</Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="page container">
            <h1 className="page-title">Kassa</h1>

            <div className="grid grid-2" style={{ alignItems: 'start' }}>
                {/* Left: Order Summary */}
                <section>
                    <Card title="Din beställning">
                        <div className="cart-items" style={{ marginBottom: '1.5rem' }}>
                            {items.map((item) => (
                                <div key={item.cartId} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--gray-100)' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                                            {item.type === 'course' && `Datum: ${item.date}`}
                                            {item.type === 'equipment' && `Storlek: ${item.size}`}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div>{parseFloat(item.price).toLocaleString('sv-SE')} kr</div>
                                        <button
                                            onClick={() => removeItem(item.cartId)}
                                            style={{ fontSize: '0.75rem', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            Ta bort
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Delsumma (exkl. moms):</span>
                                <span>{totals.subtotal} kr</span>
                            </div>
                            {parseFloat(totals.vat25) > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Moms (25%):</span>
                                    <span>{totals.vat25} kr</span>
                                </div>
                            )}
                            {parseFloat(totals.vat6) > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Moms (6%):</span>
                                    <span>{totals.vat6} kr</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '2px solid var(--gray-200)' }}>
                                <span>TOTALT:</span>
                                <span>{totals.total} kr</span>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Right: Customer Info & Payment */}
                <form onSubmit={handleSubmit}>
                    <Card title="Dina uppgifter">
                        <div className="grid grid-2">
                            <Input label="Förnamn" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} error={errors.first_name} required />
                            <Input label="Efternamn" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} error={errors.last_name} required />
                            <Input label="E-post" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} required />
                            <Input label="Telefon" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                        </div>

                        <h3 style={{ fontSize: '1rem', marginTop: '2rem', marginBottom: '1rem' }}>Välj betalsätt</h3>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <label
                                className={`payment-option ${form.payment_method === 'invoice' ? 'selected' : ''}`}
                                style={{
                                    display: 'flex', gap: '1rem', padding: '1rem', border: '1px solid var(--gray-200)',
                                    borderRadius: '8px', cursor: 'pointer',
                                    borderColor: form.payment_method === 'invoice' ? 'var(--primary)' : 'var(--gray-200)',
                                    background: form.payment_method === 'invoice' ? 'var(--blue-50)' : 'white'
                                }}
                            >
                                <input type="radio" name="payment" value="invoice" checked={form.payment_method === 'invoice'} onChange={(e) => set('payment_method', e.value)} style={{ display: 'none' }} />
                                <div style={{ fontSize: '1.5rem' }}>🧾</div>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>Faktura (30 dagar)</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>Fakturan skapas direkt och skickas till din e-post.</div>
                                </div>
                            </label>

                            {features.payment && (
                                <label
                                    className={`payment-option ${form.payment_method === 'stripe' ? 'selected' : ''}`}
                                    style={{
                                        display: 'flex', gap: '1rem', padding: '1rem', border: '1px solid var(--gray-200)',
                                        borderRadius: '8px', cursor: 'pointer',
                                        borderColor: form.payment_method === 'stripe' ? 'var(--primary)' : 'var(--gray-200)',
                                        background: form.payment_method === 'stripe' ? 'var(--blue-50)' : 'white'
                                    }}
                                >
                                    <input type="radio" name="payment" value="stripe" checked={form.payment_method === 'stripe'} onChange={(e) => set('payment_method', e.value)} style={{ display: 'none' }} />
                                    <div style={{ fontSize: '1.5rem' }}>💳</div>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>Kortbetalning (Stripe)</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>Betala direkt med VISA, Mastercard eller Apple Pay.</div>
                                    </div>
                                </label>
                            )}
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <label className="checkbox-container" style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                <input type="checkbox" checked={form.gdprConsent} onChange={e => set('gdprConsent', e.target.checked)} required />
                                <span>Jag godkänner att Dykgaraget sparar mina personuppgifter enligt <Link to="/integritetspolicy" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>integritetspolicyn</Link>.*</span>
                            </label>
                            {errors.gdprConsent && <span className="error-msg" style={{ display: 'block', marginTop: '0.25rem' }}>{errors.gdprConsent}</span>}
                        </div>

                        {errors.submit && <Alert type="error" style={{ marginTop: '1.5rem' }}>{errors.submit}</Alert>}

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            style={{ width: '100%', marginTop: '2rem' }}
                            loading={loading}
                        >
                            Slutför köp ({totals.total} kr)
                        </Button>
                    </Card>
                </form>
            </div>
        </div>
    )
}

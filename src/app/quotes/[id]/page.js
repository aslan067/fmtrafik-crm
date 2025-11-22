'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { ArrowLeft, Download, Send, Check, X, Edit, Printer, Phone, Mail } from 'lucide-react'

export default function QuoteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const printRef = useRef()
  
  const [loading, setLoading] = useState(true)
  const [quote, setQuote] = useState(null)
  const [items, setItems] = useState([])
  const [company, setCompany] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [contact, setContact] = useState(null) // Müşteri kontağı
  const [creator, setCreator] = useState(null) // Hazırlayan personel
  const [banks, setBanks] = useState([]) // Seçili bankalar

  useEffect(() => {
    loadQuoteData()
  }, [params.id])

  async function loadQuoteData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()
      
      // 1. Şirket Bilgileri
      const { data: companyData } = await supabase.from('companies').select('*').eq('id', profile.company_id).single()
      setCompany(companyData)

      // 2. Teklif Detayı
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*, customers(*)')
        .eq('id', params.id)
        .single()

      if (quoteError) throw quoteError
      setQuote(quoteData)
      setCustomer(quoteData.customers)

      // 3. Ek Veriler (Paralel)
      const [itemsRes, creatorRes, contactRes, banksRes] = await Promise.all([
        supabase.from('quote_items').select('*, products(image_url, product_code, specifications)').eq('quote_id', params.id).order('sort_order'),
        supabase.from('user_profiles').select('*').eq('id', quoteData.created_by).single(),
        quoteData.contact_id ? supabase.from('customer_contacts').select('*').eq('id', quoteData.contact_id).single() : Promise.resolve({ data: null }),
        quoteData.selected_bank_ids && quoteData.selected_bank_ids.length > 0 
          ? supabase.from('company_bank_accounts').select('*').in('id', quoteData.selected_bank_ids) 
          : Promise.resolve({ data: [] })
      ])

      setItems(itemsRes.data || [])
      setCreator(creatorRes.data)
      setContact(contactRes.data)
      setBanks(banksRes.data || [])

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(newStatus) {
    if(!confirm(`Teklif durumunu "${newStatus}" olarak değiştirmek istiyor musunuz?`)) return
    await supabase.from('quotes').update({ status: newStatus }).eq('id', params.id)
    setQuote({ ...quote, status: newStatus })
  }

  const handlePrint = () => window.print()

  // Para birimi sembolü
  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }
  const symbol = currencySymbols[quote?.currency || 'TRY']

  // Dil Kontrolü (Şablon koduna göre etiketler)
  const isEn = quote?.template_code !== 'standard_tr'
  const t = {
    quote: isEn ? 'Quote' : 'Teklif',
    date: isEn ? 'Date' : 'Tarih',
    validUntil: isEn ? 'Valid Until' : 'Geçerlilik',
    to: isEn ? 'To' : 'Sayın',
    attention: isEn ? 'Attention' : 'İlgili',
    product: isEn ? 'Product / Description' : 'Ürün / Açıklama',
    qty: isEn ? 'Qty' : 'Miktar',
    price: isEn ? 'Unit Price' : 'Birim Fiyat',
    discount: isEn ? 'Disc.' : 'İsk.',
    tax: isEn ? 'VAT' : 'KDV',
    total: isEn ? 'Total' : 'Toplam',
    subtotal: isEn ? 'Subtotal' : 'Ara Toplam',
    generalDiscount: isEn ? 'Discount' : 'İskonto',
    vatTotal: isEn ? 'Total VAT' : 'Toplam KDV',
    grandTotal: isEn ? 'Grand Total' : 'Genel Toplam',
    terms: isEn ? 'Terms & Conditions' : 'Şartlar ve Koşullar',
    preparedBy: isEn ? 'Prepared By' : 'Hazırlayan',
    bankInfo: isEn ? 'Bank Accounts' : 'Banka Hesapları',
    phone: isEn ? 'Phone' : 'Tel',
    email: isEn ? 'Email' : 'E-posta'
  }

  if (loading) return <div className="h-screen flex justify-center items-center">Yükleniyor...</div>
  if (!quote) return <div className="text-center py-10">Bulunamadı</div>

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white p-6 print:p-0">
      
      {/* Üst Bar (Yazdırırken Gizlenir) */}
      <div className="max-w-5xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <button onClick={() => router.push('/quotes')} className="flex items-center text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4 mr-2"/> Geri Dön</button>
        <div className="flex gap-2">
          {quote.status === 'draft' && (
            <>
              <button onClick={() => updateStatus('sent')} className="btn-secondary text-blue-600 bg-blue-50 hover:bg-blue-100"><Send className="w-4 h-4 mr-2"/> Gönderildi Yap</button>
              <button onClick={() => router.push(`/quotes/${quote.id}/edit`)} className="btn-secondary"><Edit className="w-4 h-4 mr-2"/> Düzenle</button>
            </>
          )}
          {quote.status === 'sent' && (
            <>
              <button onClick={() => updateStatus('approved')} className="btn-primary bg-green-600 hover:bg-green-700"><Check className="w-4 h-4 mr-2"/> Onayla</button>
              <button onClick={() => updateStatus('rejected')} className="btn-secondary text-red-600 hover:bg-red-50"><X className="w-4 h-4 mr-2"/> Reddet</button>
            </>
          )}
          <button onClick={handlePrint} className="btn-primary"><Printer className="w-4 h-4 mr-2"/> Yazdır / PDF</button>
        </div>
      </div>

      {/* TEKLİF KAĞIDI (A4 Görünüm) */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none print:max-w-none min-h-[297mm] p-10 relative text-sm text-gray-800">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
          <div>
            {/* Logo Varsa */}
            {company?.logo_url && <img src={company.logo_url} alt="Logo" className="h-16 object-contain mb-4" />}
            <h1 className="font-bold text-2xl text-gray-900">{company?.name}</h1>
            <div className="text-xs text-gray-500 mt-2 space-y-1">
              <p>{company?.address}</p>
              <p>{company?.phone && `${t.phone}: ${company.phone}`} {company?.email && ` | ${t.email}: ${company.email}`}</p>
              {company?.tax_office && <p>VD: {company.tax_office} - No: {company.tax_number}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-light text-gray-300 uppercase tracking-widest">{t.quote}</h2>
            <p className="font-bold text-lg text-gray-900 mt-2">#{quote.quote_number}</p>
            <div className="mt-4 text-sm">
              <p><span className="text-gray-500">{t.date}:</span> {new Date(quote.created_at).toLocaleDateString('tr-TR')}</p>
              <p><span className="text-gray-500">{t.validUntil}:</span> {new Date(quote.valid_until).toLocaleDateString('tr-TR')}</p>
            </div>
          </div>
        </div>

        {/* Müşteri ve Konu */}
        <div className="flex justify-between mb-10 gap-10">
          <div className="flex-1">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">{t.to}</h3>
            <p className="font-bold text-lg">{customer?.name}</p>
            <p className="whitespace-pre-line text-gray-600">{customer?.address}</p>
            {customer?.tax_office && <p className="text-xs text-gray-500 mt-1">VD: {customer.tax_office} - {customer.tax_number}</p>}
          </div>
          {contact && (
            <div className="text-right">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">{t.attention}</h3>
              <p className="font-bold">{contact.name}</p>
              <p className="text-gray-600">{contact.role}</p>
              <p className="text-gray-600">{contact.email}</p>
              <p className="text-gray-600">{contact.phone}</p>
            </div>
          )}
        </div>

        {quote.title && <div className="mb-6 font-bold text-lg border-b pb-2">{quote.title}</div>}

        {/* Tablo */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-gray-800 text-xs uppercase font-bold text-gray-600">
              <th className="py-2 text-left w-[40%]">{t.product}</th>
              <th className="py-2 text-center">{t.qty}</th>
              <th className="py-2 text-right">{t.price}</th>
              {quote.discount_amount > 0 && <th className="py-2 text-center">{t.discount}</th>}
              {items.some(i => i.tax_rate > 0) && <th className="py-2 text-center">{t.tax}</th>}
              <th className="py-2 text-right">{t.total}</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-3 pr-4">
                  <div className="flex gap-3">
                    {quote.show_product_images && item.products?.image_url && (
                      <img src={item.products.image_url} className="w-12 h-12 object-contain border rounded p-1" />
                    )}
                    <div>
                      <p className="font-bold text-gray-900">{item.description}</p>
                      {item.products?.product_code && <p className="text-xs text-gray-500 font-mono">{item.products.product_code}</p>}
                      {/* Teknik özellikler (JSON parse edip göstermek opsiyonel) */}
                      {quote.show_specifications && item.products?.specifications && (
                        <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                          {Object.entries(item.products.specifications).map(([k,v])=>`${k}: ${v}`).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 text-center font-medium">{item.quantity}</td>
                <td className="py-3 text-right">{symbol}{parseFloat(item.list_price).toLocaleString('tr-TR', {minimumFractionDigits:2})}</td>
                {quote.discount_amount > 0 && (
                  <td className="py-3 text-center text-red-600">
                    {item.discount_percentage > 0 ? `%${item.discount_percentage}` : '-'}
                  </td>
                )}
                {items.some(i => i.tax_rate > 0) && <td className="py-3 text-center text-gray-500">%{item.tax_rate}</td>}
                <td className="py-3 text-right font-bold">
                  {symbol}{parseFloat(item.total_price).toLocaleString('tr-TR', {minimumFractionDigits:2})}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Alt Kısım: Toplamlar ve Hazırlayan */}
        <div className="flex justify-end mb-12">
          <div className="w-64 space-y-2 text-right">
            <div className="flex justify-between text-gray-600">
              <span>{t.subtotal}:</span>
              <span>{symbol}{parseFloat(quote.subtotal).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
            </div>
            {quote.discount_amount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>{t.generalDiscount} ({quote.discount_percentage}%):</span>
                <span>-{symbol}{parseFloat(quote.discount_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>{t.vatTotal}:</span>
              <span>{symbol}{parseFloat(quote.tax_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
            </div>
            <div className="flex justify-between font-bold text-xl border-t-2 border-gray-800 pt-2">
              <span>{t.grandTotal}:</span>
              <span>{symbol}{parseFloat(quote.total_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
            </div>
          </div>
        </div>

        {/* Alt Footer Grid */}
        <div className="grid grid-cols-2 gap-10 border-t pt-8 page-break-inside-avoid">
          
          {/* Sol: Notlar ve Banka */}
          <div className="space-y-6 text-xs text-gray-600">
            {quote.notes && (
              <div>
                <h4 className="font-bold uppercase text-gray-400 mb-1">Notlar</h4>
                <p>{quote.notes}</p>
              </div>
            )}
            
            {banks.length > 0 && (
              <div>
                <h4 className="font-bold uppercase text-gray-400 mb-2">{t.bankInfo}</h4>
                <div className="grid grid-cols-1 gap-2">
                  {banks.map(bank => (
                    <div key={bank.id} className="bg-gray-50 p-2 rounded">
                      <p className="font-bold">{bank.bank_name} - {bank.currency}</p>
                      <p className="font-mono">{bank.iban}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {quote.terms && (
              <div>
                <h4 className="font-bold uppercase text-gray-400 mb-1">{t.terms}</h4>
                <pre className="whitespace-pre-line font-sans">{quote.terms}</pre>
              </div>
            )}
          </div>

          {/* Sağ: Hazırlayan Kişi ve İmza */}
          <div className="text-right">
            {creator && (
              <div className="inline-block text-left bg-gray-50 p-4 rounded-lg border border-gray-200 min-w-[200px]">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">{t.preparedBy}</p>
                <p className="font-bold text-gray-900 text-lg">{creator.full_name}</p>
                {creator.title && <p className="text-gray-600 text-sm">{creator.title}</p>}
                <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                  {creator.phone && <p>{t.phone}: {creator.phone}</p>}
                  {creator.email && <p>{t.email}: {creator.email}</p>}
                </div>
                {/* İmza Alanı */}
                <div className="mt-8 border-t border-gray-300 pt-2">
                  <p className="text-xs text-center text-gray-400">İmza / Kaşe</p>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      <style jsx global>{`
        @media print {
          body { bg-white; }
          @page { margin: 0; size: auto; }
          .page-break-inside-avoid { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { ArrowLeft, Download, Send, Check, X, Edit, Printer, Phone, Mail, FileText, ExternalLink } from 'lucide-react'

export default function QuoteDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  const [loading, setLoading] = useState(true)
  const [quote, setQuote] = useState(null)
  const [items, setItems] = useState([])
  const [company, setCompany] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [contact, setContact] = useState(null)
  const [creator, setCreator] = useState(null)
  const [banks, setBanks] = useState([])

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

      // 3. Ek Veriler
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

  const handlePrint = () => {
    window.print()
  }

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }
  const symbol = currencySymbols[quote?.currency || 'TRY']

  // --- Şablon Dil Ayarları ---
  const isEn = quote?.template_code !== 'standard_tr'
  const t = {
    quoteTitle: isEn ? 'PROFORMA INVOICE / QUOTE' : 'FİYAT TEKLİFİ',
    quoteNo: isEn ? 'Quote No' : 'Teklif No',
    date: isEn ? 'Date' : 'Tarih',
    validUntil: isEn ? 'Valid Until' : 'Geçerlilik',
    to: isEn ? 'Customer' : 'Sayın',
    attention: isEn ? 'Attention' : 'İlgili Kişi',
    product: isEn ? 'Description' : 'Açıklama',
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
    bankInfo: isEn ? 'Bank Account Details' : 'Banka Hesap Bilgileri',
    contact: isEn ? 'Contact' : 'İletişim',
    phone: isEn ? 'Phone' : 'Tel',
    email: isEn ? 'Email' : 'E-posta',
    preparedBy: isEn ? 'Prepared By' : 'Hazırlayan'
  }

  if (loading) return <div className="h-screen flex justify-center items-center">Yükleniyor...</div>
  if (!quote) return <div className="text-center py-10">Bulunamadı</div>

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white flex flex-col">
      
      {/* --- APP TOOLBAR (Yazdırırken Gizlenir) --- */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm print:hidden sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" /> Geri
            </button>
            <div className="h-6 w-px bg-gray-300 hidden sm:block"></div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                {quote.quote_number}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  quote.status === 'approved' ? 'bg-green-100 text-green-800' : 
                  quote.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                  'bg-gray-100 text-gray-800'
                }`}>
                  {quote.status === 'draft' ? 'Taslak' : quote.status === 'sent' ? 'Gönderildi' : quote.status}
                </span>
              </h1>
              <p className="text-xs text-gray-500">{customer?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {quote.status === 'draft' && (
              <>
                <button onClick={() => updateStatus('sent')} className="btn-secondary text-blue-600 bg-blue-50 hover:bg-blue-100 text-sm"><Send className="w-4 h-4 mr-2"/> Gönderildi İşaretle</button>
                <button onClick={() => router.push(`/quotes/${quote.id}/edit`)} className="btn-secondary text-sm"><Edit className="w-4 h-4 mr-2"/> Düzenle</button>
              </>
            )}
            {quote.status === 'sent' && (
              <>
                <button onClick={() => updateStatus('approved')} className="btn-primary bg-green-600 hover:bg-green-700 text-sm"><Check className="w-4 h-4 mr-2"/> Onayla</button>
                <button onClick={() => updateStatus('rejected')} className="btn-secondary text-red-600 hover:bg-red-50 text-sm"><X className="w-4 h-4 mr-2"/> Reddet</button>
              </>
            )}
            <button onClick={handlePrint} className="btn-primary text-sm ml-2"><Printer className="w-4 h-4 mr-2"/> Yazdır / PDF</button>
          </div>
        </div>
      </div>

      {/* --- BELGE GÖRÜNTÜLEME ALANI --- */}
      <div className="flex-1 overflow-auto py-8 px-4 print:p-0 print:overflow-visible">
        
        {/* A4 KAĞIT KONTEYNERI */}
        <div 
          id="quote-document"
          className="mx-auto bg-white shadow-2xl print:shadow-none max-w-[210mm] min-h-[297mm] p-[10mm] md:p-[15mm] relative text-sm text-gray-800 print:w-full print:max-w-none"
        >
          {/* --- HEADER --- */}
          <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
            <div className="w-1/2">
              {company?.logo_url ? (
                <img src={company.logo_url} alt="Logo" className="h-16 object-contain mb-4" />
              ) : (
                <h1 className="font-bold text-2xl text-gray-900 mb-2">{company?.name}</h1>
              )}
              <div className="text-xs text-gray-600 space-y-1">
                <p className="font-medium">{company?.address}</p>
                <div className="flex gap-3">
                  {company?.phone && <span>{t.phone}: {company.phone}</span>}
                  {company?.email && <span>{t.email}: {company.email}</span>}
                </div>
                {company?.tax_office && <p>VD: {company.tax_office} - No: {company.tax_number}</p>}
                {company?.website && <p>{company.website}</p>}
              </div>
            </div>
            
            <div className="text-right w-1/2">
              <h2 className="text-2xl font-light text-gray-400 uppercase tracking-widest mb-4">{t.quoteTitle}</h2>
              
              <div className="inline-block text-left bg-gray-50 p-3 rounded border border-gray-100 w-full max-w-[200px] float-right">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500 text-xs font-bold uppercase">{t.quoteNo}:</span>
                  <span className="font-bold text-gray-900">{quote.quote_number}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500 text-xs font-bold uppercase">{t.date}:</span>
                  <span>{new Date(quote.created_at).toLocaleDateString('tr-TR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 text-xs font-bold uppercase">{t.validUntil}:</span>
                  <span>{new Date(quote.valid_until).toLocaleDateString('tr-TR')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* --- MÜŞTERİ BİLGİLERİ --- */}
          <div className="flex justify-between mb-8 gap-8">
            <div className="flex-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-1 border-b pb-1">{t.to}</h3>
              <p className="font-bold text-lg text-gray-900">{customer?.name}</p>
              <p className="text-gray-600 whitespace-pre-line text-xs mt-1">{customer?.address}</p>
              <div className="mt-2 text-xs text-gray-500">
                {customer?.tax_office && <span>{customer.tax_office} VD - </span>}
                {customer?.tax_number && <span>VKN: {customer.tax_number}</span>}
              </div>
            </div>
            
            {contact && (
              <div className="w-1/3 text-right">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-1 border-b pb-1">{t.attention}</h3>
                <p className="font-bold text-gray-900">{contact.name}</p>
                <p className="text-xs text-gray-600">{contact.role}</p>
                <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                  {contact.phone && <p>{contact.phone}</p>}
                  {contact.email && <p>{contact.email}</p>}
                </div>
              </div>
            )}
          </div>

          {/* --- KONU --- */}
          {quote.title && (
            <div className="mb-6 bg-gray-50 p-2 rounded border border-gray-100 text-center font-medium text-gray-800">
              {quote.title}
            </div>
          )}

          {/* --- TABLO --- */}
          <table className="w-full mb-8 border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800 text-xs uppercase font-bold text-gray-600 bg-gray-50">
                <th className="py-2 px-2 text-center w-10">#</th>
                <th className="py-2 px-2 text-left">{t.product}</th>
                <th className="py-2 px-2 text-center w-20">{t.qty}</th>
                <th className="py-2 px-2 text-right w-24">{t.price}</th>
                {quote.discount_amount > 0 && <th className="py-2 px-2 text-center w-16">{t.discount}</th>}
                {items.some(i => i.tax_rate > 0) && <th className="py-2 px-2 text-center w-16">{t.tax}</th>}
                <th className="py-2 px-2 text-right w-28">{t.total}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {items.map((item, i) => (
                <tr key={i} className="border-b border-gray-200 break-inside-avoid">
                  <td className="py-3 px-2 text-center text-gray-500">{i + 1}</td>
                  <td className="py-3 px-2">
                    <div className="flex gap-3">
                      {quote.show_product_images && item.products?.image_url && (
                        <img 
                          src={item.products.image_url} 
                          className="w-12 h-12 object-contain border rounded bg-white p-0.5 print:mix-blend-multiply" 
                          alt="" 
                        />
                      )}
                      <div>
                        <p className="font-bold text-gray-900">{item.description}</p>
                        {item.products?.product_code && (
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{item.products.product_code}</p>
                        )}
                        {quote.show_specifications && item.products?.specifications && (
                          <div className="text-[10px] text-gray-500 mt-1 leading-tight">
                            {Object.entries(item.products.specifications).slice(0,4).map(([k,v]) => (
                              <span key={k} className="mr-2 inline-block">• {k}: {v}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center font-medium">{item.quantity} {item.products?.unit || 'Adet'}</td>
                  <td className="py-3 px-2 text-right font-mono">{symbol}{parseFloat(item.list_price).toLocaleString('tr-TR', {minimumFractionDigits:2})}</td>
                  
                  {quote.discount_amount > 0 && (
                    <td className="py-3 px-2 text-center text-red-600 text-xs">
                      {item.discount_percentage > 0 ? `%${item.discount_percentage}` : '-'}
                    </td>
                  )}
                  
                  {items.some(i => i.tax_rate > 0) && (
                    <td className="py-3 px-2 text-center text-gray-500 text-xs">
                      {item.tax_rate > 0 ? `%${item.tax_rate}` : '-'}
                    </td>
                  )}
                  
                  <td className="py-3 px-2 text-right font-bold text-gray-900">
                    {symbol}{parseFloat(item.total_price).toLocaleString('tr-TR', {minimumFractionDigits:2})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* --- TOPLAMLAR --- */}
          <div className="flex justify-end mb-8 break-inside-avoid">
            <div className="w-72 space-y-2 text-right text-sm">
              <div className="flex justify-between text-gray-600 border-b border-dashed pb-1">
                <span>{t.subtotal}:</span>
                <span>{symbol}{parseFloat(quote.subtotal).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
              </div>
              
              {quote.discount_amount > 0 && (
                <div className="flex justify-between text-red-600 border-b border-dashed pb-1">
                  <span>{t.generalDiscount} (%{quote.discount_percentage}):</span>
                  <span>-{symbol}{parseFloat(quote.discount_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
                </div>
              )}
              
              <div className="flex justify-between text-gray-600 border-b border-dashed pb-1">
                <span>{t.vatTotal}:</span>
                <span>{symbol}{parseFloat(quote.tax_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
              </div>
              
              <div className="flex justify-between font-bold text-xl text-gray-900 pt-2 bg-gray-50 p-2 rounded">
                <span>{t.grandTotal}:</span>
                <span>{symbol}{parseFloat(quote.total_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
              </div>
            </div>
          </div>

          {/* --- ALT BİLGİLER (Footer) --- */}
          <div className="grid grid-cols-2 gap-8 pt-4 border-t-2 border-gray-200 break-inside-avoid">
            
            {/* Sol: Banka ve Şartlar */}
            <div className="space-y-6 text-xs">
              {banks.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-800 uppercase mb-2 border-b w-fit pb-0.5">{t.bankInfo}</h4>
                  <div className="space-y-2">
                    {banks.map(bank => (
                      <div key={bank.id} className="text-gray-600">
                        <p className="font-bold text-gray-800">{bank.bank_name} - {bank.currency}</p>
                        <p className="font-mono select-all">{bank.iban}</p>
                        <p>{bank.branch_name} / {bank.account_name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(quote.notes || quote.terms) && (
                <div>
                  <h4 className="font-bold text-gray-800 uppercase mb-2 border-b w-fit pb-0.5">{t.terms}</h4>
                  {quote.notes && <p className="mb-2 text-gray-700 italic">{quote.notes}</p>}
                  <pre className="whitespace-pre-line font-sans text-gray-600 leading-relaxed">{quote.terms}</pre>
                </div>
              )}
            </div>

            {/* Sağ: Hazırlayan ve İmza */}
            <div className="flex flex-col items-end justify-between">
              {creator && (
                <div className="text-right mb-8">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">{t.preparedBy}</p>
                  <p className="font-bold text-gray-900 text-base">{creator.full_name}</p>
                  {creator.title && <p className="text-gray-600">{creator.title}</p>}
                  <div className="mt-1 text-xs text-gray-500">
                    {creator.email && <p>{creator.email}</p>}
                    {creator.phone && <p>{creator.phone}</p>}
                  </div>
                </div>
              )}
              
              <div className="w-48 border-t border-gray-400 pt-2 text-center mt-8">
                <p className="text-xs text-gray-400 font-bold uppercase">Onay / İmza / Kaşe</p>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* --- PRINT STYLE OVERRIDES --- */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #quote-document, #quote-document * {
            visibility: visible;
          }
          #quote-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 15mm !important; /* Yazıcı kenar boşluğu */
            box-shadow: none !important;
            border: none !important;
          }
          /* Arka plan grafiklerini (renkli şeritler, gri kutular) yazdır */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  )
}

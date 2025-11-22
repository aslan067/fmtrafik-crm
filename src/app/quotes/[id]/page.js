'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { ArrowLeft, Send, Check, X, Edit, Printer } from 'lucide-react'

export default function QuoteDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
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
      setLoading(true)
      setError(null)

      const user = await getCurrentUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) throw new Error('Kullanıcı profili bulunamadı.')

      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single()
      
      setCompany(companyData)

      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*, customers!inner(*)')
        .eq('id', params.id)
        .single()

      if (quoteError) throw new Error(`Teklif bulunamadı: ${quoteError.message}`)
      
      setQuote(quoteData)
      setCustomer(quoteData.customers)

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

    } catch (err) {
      console.error('Detay Yükleme Hatası:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(newStatus) {
    if(!confirm(`Teklif durumunu "${newStatus}" olarak değiştirmek istiyor musunuz?`)) return
    try {
      const { error } = await supabase.from('quotes').update({ status: newStatus }).eq('id', params.id)
      if (error) throw error
      setQuote({ ...quote, status: newStatus })
    } catch (err) {
      alert('Güncelleme hatası: ' + err.message)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }
  const symbol = currencySymbols[quote?.currency || 'TRY']

  // --- Şablon Dil Ayarları ---
  const isEn = quote?.template_code !== 'standard_tr'
  const t = {
    quoteTitle: isEn ? 'PROFORMA INVOICE' : 'FİYAT TEKLİFİ',
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

  if (loading) return <div className="h-screen flex justify-center items-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
  
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>

  if (!quote) return <div className="text-center py-20 text-gray-500">Teklif bulunamadı.</div>

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
      <div className="flex-1 overflow-auto py-8 px-4 print:p-0 print:overflow-visible print:block">
        
        {/* A4 KAĞIT KONTEYNERI (Optimize Edilmiş) */}
        <div 
          id="quote-document"
          className="mx-auto bg-white shadow-2xl print:shadow-none max-w-[210mm] min-h-[297mm] p-[10mm] relative text-xs text-gray-800 print:w-full print:max-w-none print:min-h-0 font-sans leading-tight"
        >
          {/* --- HEADER (Compact & Logo Büyütüldü) --- */}
          <div className="flex justify-between items-end border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex items-center gap-6">
              {company?.logo_url && (
                // Logo BÜYÜTÜLDÜ (h-12 -> h-24)
                <img src={company.logo_url} alt="Logo" className="h-24 w-auto object-contain" />
              )}
              <div>
                {/* Şirket İsmi KÜÇÜLTÜLDÜ (text-lg -> text-base) */}
                <h1 className="font-bold text-base text-gray-900 uppercase tracking-tight">{company?.name}</h1>
                <div className="text-[10px] text-gray-500 space-y-0.5 mt-1">
                  <p>{company?.address}</p>
                  <div className="flex gap-2">
                    {company?.phone && <span>{t.phone}: {company.phone}</span>}
                    {company?.email && <span>{t.email}: {company.email}</span>}
                  </div>
                  {company?.tax_office && <p>VD: {company.tax_office} - No: {company.tax_number}</p>}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide mb-2">{t.quoteTitle}</h2>
              <div className="text-xs text-gray-600 space-y-0.5">
                <p><span className="font-semibold">{t.quoteNo}:</span> <span className="text-gray-900">{quote.quote_number}</span></p>
                <p><span className="font-semibold">{t.date}:</span> {new Date(quote.created_at).toLocaleDateString('tr-TR')}</p>
                <p><span className="font-semibold">{t.validUntil}:</span> {new Date(quote.valid_until).toLocaleDateString('tr-TR')}</p>
              </div>
            </div>
          </div>

          {/* --- MÜŞTERİ BİLGİLERİ (Ara Boşluk Kaldırıldı) --- */}
          <div className="flex justify-between mb-4 gap-8 items-start">
            <div className="flex-1">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-1 border-b w-full pb-0.5">{t.to}</h3>
              <p className="font-bold text-base text-gray-900">{customer?.name}</p>
              <p className="text-gray-600 whitespace-pre-line mt-0.5 max-w-sm">{customer?.address}</p>
              {customer?.tax_office && <p className="text-gray-500 mt-1 text-[10px]">VD: {customer.tax_office} - VKN: {customer.tax_number}</p>}
            </div>
            
            {contact && (
              <div className="w-1/3 text-right">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-1 border-b w-full pb-0.5">{t.attention}</h3>
                <p className="font-bold text-gray-900">{contact.name}</p>
                {contact.role && <p className="text-gray-600">{contact.role}</p>}
                <div className="mt-1 text-gray-500 space-y-0.5 text-[10px]">
                  {contact.phone && <p>{contact.phone}</p>}
                  {contact.email && <p>{contact.email}</p>}
                </div>
              </div>
            )}
          </div>

          {/* --- KONU --- */}
          {quote.title && (
            <div className="mb-4 bg-gray-50 p-1.5 rounded border border-gray-100 text-center font-semibold text-gray-800 text-sm">
              {quote.title}
            </div>
          )}

          {/* --- TABLO (Optimize Edilmiş) --- */}
          <table className="w-full mb-6 border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800 text-[10px] uppercase font-bold text-gray-600 bg-gray-50">
                <th className="py-1.5 px-2 text-center w-8">#</th>
                <th className="py-1.5 px-2 text-left">{t.product}</th>
                <th className="py-1.5 px-2 text-center w-16">{t.qty}</th>
                <th className="py-1.5 px-2 text-right w-24">{t.price}</th>
                {quote.discount_amount > 0 && <th className="py-1.5 px-2 text-center w-14">{t.discount}</th>}
                {items.some(i => i.tax_rate > 0) && <th className="py-1.5 px-2 text-center w-12">{t.tax}</th>}
                <th className="py-1.5 px-2 text-right w-24">{t.total}</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {items.map((item, i) => (
                <tr key={i} className="border-b border-gray-200 break-inside-avoid">
                  <td className="py-1.5 px-2 text-center text-gray-500 align-top">{i + 1}</td>
                  <td className="py-1.5 px-2">
                    <div className="flex gap-2 items-start">
                      {/* Ürün Görseli Büyütüldü ve Hizalandı */}
                      {quote.show_product_images && item.products?.image_url && (
                        <img 
                          src={item.products.image_url} 
                          className="w-12 h-12 object-contain border rounded bg-white p-0.5 print:mix-blend-multiply flex-shrink-0" 
                          alt="" 
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 leading-snug">{item.description}</p>
                        {item.products?.product_code && (
                          <p className="text-[10px] text-gray-500 font-mono">{item.products.product_code}</p>
                        )}
                        {/* Teknik özellikler */}
                        {quote.show_specifications && item.products?.specifications && (
                          <div className="text-[9px] text-gray-500 mt-1 leading-tight">
                            {Object.entries(item.products.specifications).slice(0,4).map(([k,v]) => (
                              <span key={k} className="mr-2 inline-block text-gray-400"><b className="text-gray-500">{k}:</b> {v}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-center font-medium whitespace-nowrap align-top pt-3">{item.quantity} {item.products?.unit}</td>
                  <td className="py-1.5 px-2 text-right font-mono align-top pt-3">{symbol}{parseFloat(item.list_price).toLocaleString('tr-TR', {minimumFractionDigits:2})}</td>
                  
                  {quote.discount_amount > 0 && (
                    <td className="py-1.5 px-2 text-center text-red-600 text-[10px] align-top pt-3">
                      {item.discount_percentage > 0 ? `%${item.discount_percentage}` : '-'}
                    </td>
                  )}
                  
                  {items.some(i => i.tax_rate > 0) && (
                    <td className="py-1.5 px-2 text-center text-gray-500 text-[10px] align-top pt-3">
                      {item.tax_rate > 0 ? `%${item.tax_rate}` : '-'}
                    </td>
                  )}
                  
                  <td className="py-1.5 px-2 text-right font-bold text-gray-900 align-top pt-3">
                    {symbol}{parseFloat(item.total_price).toLocaleString('tr-TR', {minimumFractionDigits:2})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* --- TOPLAMLAR --- */}
          <div className="flex justify-end mb-6 break-inside-avoid">
            <div className="w-64 space-y-1 text-right text-xs">
              <div className="flex justify-between text-gray-600 border-b border-dashed border-gray-300 pb-1">
                <span>{t.subtotal}:</span>
                <span>{symbol}{parseFloat(quote.subtotal).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
              </div>
              
              {quote.discount_amount > 0 && (
                <div className="flex justify-between text-red-600 border-b border-dashed border-gray-300 pb-1">
                  <span>{t.generalDiscount} (%{quote.discount_percentage}):</span>
                  <span>-{symbol}{parseFloat(quote.discount_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
                </div>
              )}
              
              <div className="flex justify-between text-gray-600 border-b border-dashed border-gray-300 pb-1">
                <span>{t.vatTotal}:</span>
                <span>{symbol}{parseFloat(quote.tax_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
              </div>
              
              <div className="flex justify-between font-bold text-lg text-gray-900 pt-1">
                <span>{t.grandTotal}:</span>
                <span>{symbol}{parseFloat(quote.total_amount).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
              </div>
            </div>
          </div>

          {/* --- ALT BİLGİLER (Footer) --- */}
          <div className="grid grid-cols-2 gap-8 pt-4 border-t-2 border-gray-200 break-inside-avoid text-[10px]">
            
            {/* Sol: Banka ve Şartlar */}
            <div className="space-y-4">
              {banks.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-800 uppercase mb-1 border-b w-fit pb-0.5">{t.bankInfo}</h4>
                  <div className="space-y-1.5">
                    {banks.map(bank => (
                      <div key={bank.id} className="text-gray-600 leading-snug">
                        <span className="font-bold text-gray-800">{bank.bank_name} ({bank.currency}):</span> <span className="font-mono select-all">{bank.iban}</span>
                        <br/><span className="text-gray-400 italic">{bank.branch_name} / {bank.account_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(quote.notes || quote.terms) && (
                <div>
                  <h4 className="font-bold text-gray-800 uppercase mb-1 border-b w-fit pb-0.5">{t.terms}</h4>
                  {quote.notes && <p className="mb-2 text-gray-700 italic font-medium">{quote.notes}</p>}
                  <pre className="whitespace-pre-line font-sans text-gray-600 leading-relaxed">{quote.terms}</pre>
                </div>
              )}
            </div>

            {/* Sağ: Hazırlayan ve İmza */}
            <div className="flex flex-col items-end justify-between">
              {creator && (
                <div className="text-right mb-6">
                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">{t.preparedBy}</p>
                  <p className="font-bold text-gray-900 text-sm">{creator.full_name}</p>
                  {creator.title && <p className="text-gray-600">{creator.title}</p>}
                  <div className="mt-1 text-gray-500 space-y-0.5">
                    {creator.email && <p>{creator.email}</p>}
                    {creator.phone && <p>{creator.phone}</p>}
                  </div>
                </div>
              )}
              
              <div className="w-40 border-t border-gray-400 pt-2 text-center mt-4">
                <p className="text-[9px] text-gray-400 font-bold uppercase">Onay / İmza / Kaşe</p>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* --- PRINT STYLE OVERRIDES --- */}
      <style jsx global>{`
        @media print {
          /* Reset */
          *, *:before, *:after {
            box-shadow: none !important;
            text-shadow: none !important;
          }
          
          /* Hide Everything */
          body {
            visibility: hidden;
            background-color: white !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Show Quote */
          #quote-document, #quote-document * {
            visibility: visible;
          }

          /* Position Quote */
          #quote-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 5mm !important; /* MİNİMUM KENAR BOŞLUĞU */
            border: none !important;
            background-color: white !important;
          }

          /* Remove Defaults */
          @page {
            margin: 0; /* Tarayıcı marginini sıfırla */
            size: auto;
          }
          
          /* Container Fixes */
          .min-h-screen {
            min-height: 0 !important;
            height: auto !important;
            display: block !important;
          }
          
          .flex-1 {
            flex: none !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  )
}

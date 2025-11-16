'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { ArrowLeft, Download, Send, Check, X, Edit, Printer } from 'lucide-react'

export default function QuoteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const printRef = useRef()
  
  const [loading, setLoading] = useState(true)
  const [quote, setQuote] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [items, setItems] = useState([])
  const [company, setCompany] = useState(null)

  useEffect(() => {
    loadQuote()
  }, [params.id])

  async function loadQuote() {
    try {
      const user = await getCurrentUser()
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*, companies(*)')
        .eq('id', user.id)
        .single()
      
      setCompany(profile.companies)

      // Teklifi yükle
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*, customers(*)')
        .eq('id', params.id)
        .single()

      if (quoteError) throw quoteError
      setQuote(quoteData)
      setCustomer(quoteData.customers)

      // Teklif kalemlerini yükle
      const { data: itemsData, error: itemsError } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', params.id)
        .order('sort_order')

      if (itemsError) throw itemsError
      setItems(itemsData || [])

    } catch (error) {
      console.error('Error loading quote:', error)
      alert('Teklif yüklenirken hata oluştu')
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  async function updateQuoteStatus(newStatus) {
    try {
      const updates = { status: newStatus }
      if (newStatus === 'approved') {
        updates.approved_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', params.id)

      if (error) throw error

      setQuote({ ...quote, ...updates })
      alert(`Teklif ${newStatus === 'approved' ? 'onaylandı' : 'reddedildi'}!`)
    } catch (error) {
      console.error('Error updating quote:', error)
      alert('Durum güncellenirken hata oluştu')
    }
  }

  function handlePrint() {
    window.print()
  }

  function handleDownloadPDF() {
    // Basit çözüm: Print dialog'u aç, kullanıcı "Save as PDF" seçsin
    window.print()
  }

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }

    const labels = {
      draft: 'Taslak',
      sent: 'Gönderildi',
      approved: 'Onaylandı',
      rejected: 'Reddedildi',
    }

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600">Teklif bulunamadı</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Action Bar - Print'te gizlenecek */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Geri
          </button>

          <div className="flex items-center gap-3">
            {quote.status === 'draft' && (
              <>
                <button
                  onClick={() => updateQuoteStatus('sent')}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Gönderildi Olarak İşaretle
                </button>
                <button
                  onClick={() => router.push(`/quotes/${params.id}/edit`)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Edit className="w-5 h-5" />
                  Düzenle
                </button>
              </>
            )}

            {quote.status === 'sent' && (
              <>
                <button
                  onClick={() => updateQuoteStatus('approved')}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Onayla
                </button>
                <button
                  onClick={() => updateQuoteStatus('rejected')}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Reddet
                </button>
              </>
            )}

            <button
              onClick={handlePrint}
              className="btn-secondary flex items-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Yazdır
            </button>

            <button
              onClick={handleDownloadPDF}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              PDF İndir
            </button>
          </div>
        </div>
      </div>

      {/* Teklif İçeriği - PDF'e dönüşecek */}
      <div className="p-6 print:p-0">
        <div ref={printRef} className="max-w-5xl mx-auto bg-white shadow-lg print:shadow-none">
          {/* Header */}
          <div className="p-8 border-b-4 border-blue-600 print:border-b-2">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {company?.name || 'FM Trafik'}
                </h1>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Adres bilgileri buraya gelecek</p>
                  <p>Telefon: 0xxx xxx xx xx</p>
                  <p>Email: info@fmtrafik.com</p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-600 mb-2">Teklif No</div>
                <div className="text-2xl font-bold text-blue-600 mb-4">
                  {quote.quote_number}
                </div>
                <div className="print:hidden">
                  {getStatusBadge(quote.status)}
                </div>
              </div>
            </div>
          </div>

          {/* Müşteri ve Tarih Bilgileri */}
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-gray-200">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                Müşteri Bilgileri
              </h3>
              <div className="space-y-2">
                <p className="font-bold text-gray-900 text-lg">{customer.name}</p>
                {customer.tax_office && (
                  <p className="text-sm text-gray-600">
                    Vergi Dairesi: {customer.tax_office}
                  </p>
                )}
                {customer.tax_number && (
                  <p className="text-sm text-gray-600">
                    Vergi No: {customer.tax_number}
                  </p>
                )}
                {customer.address && (
                  <p className="text-sm text-gray-600">{customer.address}</p>
                )}
                {customer.email && (
                  <p className="text-sm text-gray-600">{customer.email}</p>
                )}
                {customer.phone && (
                  <p className="text-sm text-gray-600">{customer.phone}</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                Teklif Detayları
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Teklif Tarihi:</span>
                  <span className="font-medium">
                    {new Date(quote.created_at).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                {quote.valid_until && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Geçerlilik Tarihi:</span>
                    <span className="font-medium">
                      {new Date(quote.valid_until).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                )}
                {quote.title && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Konu:</span>
                    <span className="font-medium">{quote.title}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Teklif Kalemleri */}
          <div className="p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Teklif Kalemleri
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">
                      #
                    </th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">
                      Açıklama
                    </th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700">
                      Adet
                    </th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">
                      Liste Fiyatı
                    </th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700">
                      İsk. %
                    </th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">
                      Birim Fiyat
                    </th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">
                      Toplam
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-200">
                      <td className="py-3 px-2 text-gray-600">{index + 1}</td>
                      <td className="py-3 px-2 text-gray-900">
                        {item.description}
                      </td>
                      <td className="py-3 px-2 text-center text-gray-900">
                        {parseFloat(item.quantity).toLocaleString('tr-TR', { 
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2 
                        })}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-600">
                        ₺{parseFloat(item.list_price).toLocaleString('tr-TR', { 
                          minimumFractionDigits: 2 
                        })}
                      </td>
                      <td className="py-3 px-2 text-center text-gray-600">
                        {parseFloat(item.discount_percentage).toFixed(0)}%
                      </td>
                      <td className="py-3 px-2 text-right text-gray-900 font-medium">
                        ₺{parseFloat(item.unit_price).toLocaleString('tr-TR', { 
                          minimumFractionDigits: 2 
                        })}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-900 font-semibold">
                        ₺{parseFloat(item.total_price).toLocaleString('tr-TR', { 
                          minimumFractionDigits: 2 
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Özet */}
            <div className="mt-6 flex justify-end">
              <div className="w-full md:w-96 space-y-3">
                <div className="flex justify-between text-sm py-2">
                  <span className="text-gray-600">Ara Toplam:</span>
                  <span className="font-medium text-gray-900">
                    ₺{parseFloat(quote.subtotal).toLocaleString('tr-TR', { 
                      minimumFractionDigits: 2 
                    })}
                  </span>
                </div>

                {quote.discount_percentage > 0 && (
                  <div className="flex justify-between text-sm py-2">
                    <span className="text-gray-600">
                      Genel İskonto ({parseFloat(quote.discount_percentage).toFixed(0)}%):
                    </span>
                    <span className="font-medium text-red-600">
                      -₺{parseFloat(quote.discount_amount).toLocaleString('tr-TR', { 
                        minimumFractionDigits: 2 
                      })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm py-2 border-t border-gray-200">
                  <span className="text-gray-600">
                    KDV (%{parseFloat(quote.tax_rate).toFixed(0)}):
                  </span>
                  <span className="font-medium text-gray-900">
                    ₺{parseFloat(quote.tax_amount).toLocaleString('tr-TR', { 
                      minimumFractionDigits: 2 
                    })}
                  </span>
                </div>

                <div className="flex justify-between text-lg py-3 border-t-2 border-gray-300">
                  <span className="font-bold text-gray-900">GENEL TOPLAM:</span>
                  <span className="font-bold text-blue-600 text-xl">
                    ₺{parseFloat(quote.total_amount).toLocaleString('tr-TR', { 
                      minimumFractionDigits: 2 
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notlar ve Şartlar */}
          {(quote.notes || quote.terms) && (
            <div className="p-8 bg-gray-50 border-t border-gray-200">
              {quote.notes && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
                    Notlar
                  </h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {quote.notes}
                  </p>
                </div>
              )}

              {quote.terms && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
                    Şartlar ve Koşullar
                  </h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {quote.terms}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="p-8 text-center text-sm text-gray-500 border-t border-gray-200">
            <p>Bu teklif {new Date(quote.valid_until).toLocaleDateString('tr-TR')} tarihine kadar geçerlidir.</p>
            <p className="mt-2">Teşekkür ederiz.</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-b-2 {
            border-bottom-width: 2px !important;
          }
        }
      `}</style>
    </div>
  )
}

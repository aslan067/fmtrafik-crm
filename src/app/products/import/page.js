'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'

export default function ProductImportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [productGroups, setProductGroups] = useState([])
  const [preview, setPreview] = useState([])
  const [errors, setErrors] = useState([])
  const [success, setSuccess] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const user = await getCurrentUser()
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', profile.company_id)
      
      setSuppliers(suppliersData || [])

      const { data: groupsData } = await supabase
        .from('product_groups')
        .select('*')
        .eq('company_id', profile.company_id)
      
      setProductGroups(groupsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  function downloadTemplate() {
    const template = `ÜRÜN_KODU,ÜRÜN_ADI,KATEGORİ,AÇIKLAMA,BİRİM,TEDARİKÇİ_KODU,GRUP_KODU,TEDARİKÇİ_LİSTE_FİYATI,TEDARİKÇİ_İSKONTO_%,ÖZELLİKLER,AKTİF,YAYINLA
TR-001,Trafik Levhası A1,Levhalar,Reflektif 60x60cm levha,Adet,SUP001,A,1000,50,"renk:Sarı,malzeme:Plastik",EVET,EVET
TR-002,Bariyer 2m,Bariyerler,Galvanizli çelik bariyer,Adet,SUP002,B,2400,25,"renk:Beyaz,uzunluk:200cm",EVET,EVET
TR-003,Yol Boyası,Boyalar,Termoplastik 25kg,Kova,SUP003,C,850,,"tip:Termoplastik,ağırlık:25kg",EVET,HAYIR`

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'urun-import-sablonu.csv'
    link.click()
  }

  async function handleFileChange(e) {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setErrors([])
    setPreview([])

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target.result
        const lines = text.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.trim())
        
        const previewData = lines.slice(1, 6).map((line, idx) => {
          const values = line.split(',')
          const row = {}
          headers.forEach((header, i) => {
            row[header] = values[i]?.trim() || ''
          })
          return { line: idx + 2, ...row }
        })

        setPreview(previewData)
      } catch (error) {
        setErrors([`Dosya okunamadı: ${error.message}`])
      }
    }

    reader.readAsText(selectedFile, 'UTF-8')
  }

  async function handleImport() {
    if (!file) return

    setLoading(true)
    setErrors([])
    setSuccess(0)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const user = await getCurrentUser()
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        const text = event.target.result
        const lines = text.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.trim())
        
        const importErrors = []
        let successCount = 0

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = lines[i].split(',')
            const row = {}
            headers.forEach((header, idx) => {
              row[header] = values[idx]?.trim() || ''
            })

            // Tedarikçi bul
            const supplier = suppliers.find(s => s.code === row.TEDARİKÇİ_KODU)
            if (!supplier) {
              importErrors.push(`Satır ${i + 1}: Tedarikçi bulunamadı (${row.TEDARİKÇİ_KODU})`)
              continue
            }

            // Grup bul
            const group = productGroups.find(g => g.code === row.GRUP_KODU)
            if (!group) {
              importErrors.push(`Satır ${i + 1}: Ürün grubu bulunamadı (${row.GRUP_KODU})`)
              continue
            }

            // Fiyat hesaplamaları
            const supplierListPrice = parseFloat(row.TEDARİKÇİ_LİSTE_FİYATI)
            const supplierDiscount = parseFloat(row['TEDARİKÇİ_İSKONTO_%'] || supplier.discount_value || 0)
            
            let ourCost = 0
            let dealerList = 0

            if (supplier.discount_type === 'percentage') {
              ourCost = supplierListPrice * (1 - supplierDiscount / 100)
              dealerList = ourCost * 1.25 // %25 kar marjı
            } else {
              ourCost = supplierListPrice
              dealerList = ourCost * (supplier.price_multiplier || 1.8)
            }

            const dealerDiscount = group.dealer_discount_percentage
            const dealerNet = dealerList * (1 - dealerDiscount / 100)
            const profitMargin = ((dealerNet - ourCost) / dealerNet) * 100

            // Özellikleri parse et
            let specifications = {}
            if (row.ÖZELLİKLER) {
              const specs = row.ÖZELLİKLER.split(',')
              specs.forEach(spec => {
                const [key, value] = spec.split(':')
                if (key && value) {
                  specifications[key.trim()] = value.trim()
                }
              })
            }

            // Ürünü kaydet
            const insertData = {
              company_id: profile.company_id,
              supplier_id: supplier.id,
              product_group_id: group.id,
              product_code: row.ÜRÜN_KODU,
              name: row.ÜRÜN_ADI,
              category: row.KATEGORİ || null,
              description: row.AÇIKLAMA || null,
              unit: row.BİRİM || 'Adet',
              supplier_list_price: supplierListPrice,
              supplier_discount_percentage: supplierDiscount,
              our_cost_price: ourCost,
              dealer_list_price: dealerList,
              dealer_discount_percentage: dealerDiscount,
              dealer_net_price: dealerNet,
              profit_margin_percentage: profitMargin,
              list_price: dealerList,
              specifications: specifications,
              is_active: row.AKTİF?.toUpperCase() === 'EVET',
              is_published: row.YAYINLA?.toUpperCase() === 'EVET'
            }

            const { error } = await supabase
              .from('products')
              .insert([insertData])

            if (error) throw error
            successCount++

          } catch (error) {
            importErrors.push(`Satır ${i + 1}: ${error.message}`)
          }
        }

        setSuccess(successCount)
        setErrors(importErrors)

        if (successCount > 0 && importErrors.length === 0) {
          setTimeout(() => {
            router.push('/products')
          }, 2000)
        }

      } catch (error) {
        setErrors([`Import hatası: ${error.message}`])
      } finally {
        setLoading(false)
      }
    }

    reader.readAsText(file, 'UTF-8')
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Toplu Ürün İçe Aktarma</h1>
            <p className="text-gray-600 mt-2">CSV dosyası ile toplu ürün ekleyin</p>
          </div>

          {/* Adımlar */}
          <div className="card mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 İçe Aktarma Adımları</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-blue-600">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900">Şablon dosyasını indirin</p>
                  <p className="text-sm text-gray-600">CSV formatında örnek dosyayı indirin ve düzenleyin</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-blue-600">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900">Ürün bilgilerini girin</p>
                  <p className="text-sm text-gray-600">Her satıra bir ürün olmak üzere bilgileri doldurun</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-blue-600">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900">Dosyayı yükleyin ve önizleyin</p>
                  <p className="text-sm text-gray-600">İlk 5 ürünü kontrol edin</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-blue-600">
                  4
                </div>
                <div>
                  <p className="font-medium text-gray-900">İçe aktarma işlemini başlatın</p>
                  <p className="text-sm text-gray-600">Tüm ürünler otomatik olarak eklenecek</p>
                </div>
              </div>
            </div>
          </div>

          {/* Şablon İndirme */}
          <div className="card mb-6 bg-gradient-to-br from-green-50 to-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">CSV Şablon Dosyası</h3>
                <p className="text-sm text-gray-600">Örnek verilerle hazırlanmış şablon dosyasını indirin</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="btn-primary flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Şablonu İndir
              </button>
            </div>

            <div className="mt-4 p-3 bg-white rounded-lg">
              <p className="text-sm font-medium text-gray-900 mb-2">📌 Önemli Notlar:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• TEDARİKÇİ_KODU: Mevcut tedarikçi kodlarından biri olmalı ({suppliers.map(s => s.code).join(', ')})</li>
                <li>• GRUP_KODU: Mevcut grup kodlarından biri olmalı ({productGroups.map(g => g.code).join(', ')})</li>
                <li>• AKTİF ve YAYINLA: EVET veya HAYIR yazın</li>
                <li>• ÖZELLİKLER: anahtar:değer formatında, virgülle ayırın</li>
              </ul>
            </div>
          </div>

          {/* Dosya Yükleme */}
          <div className="card mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📁 Dosya Yükleme</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {file ? file.name : 'CSV dosyası seçin'}
                </p>
                <p className="text-sm text-gray-600">
                  veya dosyayı buraya sürükleyin
                </p>
              </label>
            </div>
          </div>

          {/* Önizleme */}
          {preview.length > 0 && (
            <div className="card mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">👁️ Önizleme (İlk 5 Ürün)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Satır</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Ürün Kodu</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Ürün Adı</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tedarikçi</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Grup</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Fiyat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {preview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">{row.line}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{row.ÜRÜN_KODU}</td>
                        <td className="px-3 py-2 text-gray-900">{row.ÜRÜN_ADI}</td>
                        <td className="px-3 py-2 text-gray-600">{row.TEDARİKÇİ_KODU}</td>
                        <td className="px-3 py-2 text-gray-600">{row.GRUP_KODU}</td>
                        <td className="px-3 py-2 text-right text-gray-900">{row.TEDARİKÇİ_LİSTE_FİYATI}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sonuçlar */}
          {success > 0 && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">Başarılı!</p>
                <p className="text-sm text-green-700">{success} ürün başarıyla eklendi</p>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Hatalar ({errors.length})</p>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <ul className="text-sm text-red-700 space-y-1">
                  {errors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* İçe Aktarma Butonu */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => router.push('/products')}
              className="btn-secondary"
            >
              İptal
            </button>
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>İçe Aktarılıyor...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>İçe Aktarmayı Başlat</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

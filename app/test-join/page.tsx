'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function TestJoinPage() {
  const [joinedData, setJoinedData] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchJoinedData() {
      try {
        const { data, error } = await supabase
          .from('images')
          .select(`
            id,
            created_at,
            image_hash,
            imgur_url,
            filename,
            datasets (
              id,
              dataset_name,
              dataset_des
            )
          `)
          .order('created_at', { ascending: false })
          .limit(10)

        if (error) throw error

        console.log('Fetched data:', data) // Log the fetched data
        setJoinedData(data || [])
      } catch (err) {
        console.error('Error fetching data:', err) // Log any errors
        setError('Error fetching joined data: ' + (err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchJoinedData()
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Test Join: Images and Datasets</h1>
      {error && <p className="text-red-500">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : joinedData.length > 0 ? (
        <ul>
          {joinedData.map((item) => (
            <li key={item.id} className="mb-4">
              <h2 className="text-xl font-semibold">{item.filename}</h2>
              <p>Image ID: {item.id}</p>
              <p>Image Created At: {new Date(item.created_at).toLocaleString()}</p>
              <p>Image Hash: {item.image_hash}</p>
              <p>Imgur URL: {item.imgur_url}</p>
              <p>Dataset ID: {item.datasets?.id}</p>
              <p>Dataset Name: {item.datasets?.dataset_name}</p>
              <p>Dataset Description: {item.datasets?.dataset_des}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No data found. Please check your database connections and data.</p>
      )}
    </div>
  )
}
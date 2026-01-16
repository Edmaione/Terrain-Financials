'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CashFlowData } from '@/types'

export default function CashFlowChart({ data }: { data: CashFlowData[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No cash flow data available
      </div>
    )
  }
  
  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    'Cash In': item.cash_in,
    'Cash Out': item.cash_out,
    'Balance': item.ending_balance,
  }))
  
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `$${value.toLocaleString()}`}
        />
        <Tooltip 
          formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="Cash In" 
          stroke="#10b981" 
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line 
          type="monotone" 
          dataKey="Cash Out" 
          stroke="#ef4444" 
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line 
          type="monotone" 
          dataKey="Balance" 
          stroke="#3b82f6" 
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

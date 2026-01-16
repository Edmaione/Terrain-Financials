const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'YOUR_URL_HERE'
const supabaseKey = 'YOUR_SERVICE_ROLE_KEY_HERE'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('accounts').select('*').limit(1)
  console.log('Data:', data)
  console.log('Error:', error)
}

test()
```

4. Replace `YOUR_URL_HERE` and `YOUR_SERVICE_ROLE_KEY_HERE` with your actual keys
5. Save it
6. In terminal: `node test-supabase.js`

**This will tell us if the connection works at all.**

---

**OR - simpler approach:**

Can you copy-paste your EXACT `.env.local` file here (but **replace the actual key values** with "XXX" so I can see the format)?

Like this:
```
NEXT_PUBLIC_SUPABASE_URL=https://XXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyXXX...
SUPABASE_SERVICE_ROLE_KEY=eyXXX...
import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { Layout } from './components/Layout'
import { LiveInit } from './pages/LiveInit'
import { LiveBroadcasting } from './pages/LiveBroadcasting'
import { LiveViewer } from './pages/LiveViewer'

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => null,
})

// ── /:login/live-init ────────────────────────────────────────────────────────
const liveInitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$login/live-init',
  component: LiveInit,
})

// ── /:login/live-broadcasting ────────────────────────────────────────────────
const liveBroadcastingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$login/live-broadcasting',
  component: LiveBroadcasting,
})

// ── /:login/live-viewer ──────────────────────────────────────────────────────
// If nobody with that login is currently live → redirect to /:login/live-init
const liveViewerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$login/live-viewer',
  beforeLoad: async ({ params }) => {
    let broadcasterName: string | null = null
    try {
      const res = await fetch('http://localhost:8080/api/broadcaster')
      const data = await res.json()
      broadcasterName = data.name ?? null
    } catch {
      // signaling server down → send to init
    }

    if (broadcasterName !== params.login) {
      throw redirect({ to: '/$login/live-init', params: { login: params.login } })
    }
  },
  component: LiveViewer,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  liveInitRoute,
  liveBroadcastingRoute,
  liveViewerRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

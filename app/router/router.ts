import { createRouter, createWebHistory } from 'vue-router'
import MapView from '../views/MapView.vue'
import HomeView from '@/views/HomeView.vue'
import SelectedView from '@/views/SelectedView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../components/LoginForm.vue')
    },
	{
      path: '',
      name: 'home',
      component: HomeView,
    },
	{
      path: '/select/:share_id',
      name: 'selectedShare',
      component: SelectedView,
	  props: true,
    },
    // {
    //   path: '/about',
    //   name: 'about',
    //   // route level code-splitting
    //   // this generates a separate chunk (About.[hash].js) for this route
    //   // which is lazy-loaded when the route is visited.
    //   component: () => import('../views/AboutView.vue')
    // }
  ]
})

export default router

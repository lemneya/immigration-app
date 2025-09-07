import { Fragment, ReactNode, useState } from 'react';
import { Dialog, Disclosure, Menu, Transition } from '@headlessui/react';
import {
  Bars3Icon,
  BellIcon,
  ChartBarIcon,
  CogIcon,
  DocumentTextIcon,
  HomeIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  UsersIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  ServerIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useRouter } from 'next/router';
import clsx from 'clsx';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { 
    name: 'Services', 
    icon: ServerIcon,
    children: [
      { name: 'Service Health', href: '/services/health' },
      { name: 'Service Metrics', href: '/services/metrics' },
      { name: 'Service Logs', href: '/services/logs' },
    ]
  },
  { 
    name: 'Case Status', 
    icon: ClipboardDocumentListIcon,
    children: [
      { name: 'Tracked Cases', href: '/case-status/tracked' },
      { name: 'Status History', href: '/case-status/history' },
      { name: 'Case Analytics', href: '/case-status/analytics' },
    ]
  },
  { 
    name: 'E-Signatures', 
    icon: PencilSquareIcon,
    children: [
      { name: 'Signature Requests', href: '/signatures/requests' },
      { name: 'Templates', href: '/signatures/templates' },
      { name: 'Signature Analytics', href: '/signatures/analytics' },
    ]
  },
  { 
    name: 'Documents', 
    icon: DocumentTextIcon,
    children: [
      { name: 'OCR Jobs', href: '/documents/ocr' },
      { name: 'PDF Generation', href: '/documents/pdf' },
      { name: 'Document Analytics', href: '/documents/analytics' },
    ]
  },
  { name: 'Users', href: '/users', icon: UsersIcon },
  { name: 'Alerts', href: '/alerts', icon: ExclamationTriangleIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
];

const userNavigation = [
  { name: 'Your Profile', href: '/profile' },
  { name: 'Settings', href: '/settings' },
  { name: 'Sign out', href: '/auth/signout' },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  const isCurrentPath = (href: string) => {
    if (href === '/') {
      return router.pathname === '/';
    }
    return router.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
          </Transition.Child>

          <div className="fixed inset-0 z-40 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col bg-white pt-5 pb-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute top-0 right-0 -mr-12 pt-2">
                    <button
                      type="button"
                      className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                <div className="flex flex-shrink-0 items-center px-4">
                  <h1 className="text-xl font-bold text-immigration-600">Immigration Suite</h1>
                </div>
                <div className="mt-5 h-0 flex-1 overflow-y-auto">
                  <nav className="space-y-1 px-2">
                    {navigation.map((item) => (
                      <div key={item.name}>
                        {item.children ? (
                          <Disclosure>
                            {({ open }) => (
                              <>
                                <Disclosure.Button
                                  className={clsx(
                                    'w-full flex items-center justify-between py-2 pr-2 pl-3 text-sm font-medium rounded-md transition-colors duration-200',
                                    'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                  )}
                                >
                                  <div className="flex items-center">
                                    <item.icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                                    {item.name}
                                  </div>
                                  <ChevronRightIcon
                                    className={clsx(
                                      'h-4 w-4 transition-transform duration-200',
                                      open ? 'rotate-90' : ''
                                    )}
                                  />
                                </Disclosure.Button>
                                <Disclosure.Panel className="space-y-1">
                                  {item.children.map((child) => (
                                    <Link
                                      key={child.name}
                                      href={child.href}
                                      className={clsx(
                                        'flex items-center py-2 pl-10 pr-3 text-sm rounded-md transition-colors duration-200',
                                        isCurrentPath(child.href)
                                          ? 'bg-immigration-100 text-immigration-900 font-medium'
                                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                      )}
                                      onClick={() => setSidebarOpen(false)}
                                    >
                                      {child.name}
                                    </Link>
                                  ))}
                                </Disclosure.Panel>
                              </>
                            )}
                          </Disclosure>
                        ) : (
                          <Link
                            href={item.href}
                            className={clsx(
                              'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                              isCurrentPath(item.href)
                                ? 'bg-immigration-100 text-immigration-900'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            )}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <item.icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                            {item.name}
                          </Link>
                        )}
                      </div>
                    ))}
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
            <div className="w-14 flex-shrink-0" aria-hidden="true">
              {/* Dummy element to force sidebar to shrink to fit close icon */}
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <ShieldCheckIcon className="h-8 w-8 text-immigration-600 mr-3" />
            <h1 className="text-xl font-bold text-immigration-600">Immigration Suite</h1>
          </div>
          <div className="mt-5 flex-grow flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => (
                <div key={item.name}>
                  {item.children ? (
                    <Disclosure defaultOpen={item.children.some(child => isCurrentPath(child.href))}>
                      {({ open }) => (
                        <>
                          <Disclosure.Button
                            className={clsx(
                              'w-full flex items-center justify-between py-2 pr-2 pl-3 text-sm font-medium rounded-md transition-colors duration-200',
                              'text-gray-600 hover:bg-gray-100 hover:text-gray-900 group'
                            )}
                          >
                            <div className="flex items-center">
                              <item.icon 
                                className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-gray-500" 
                                aria-hidden="true" 
                              />
                              {item.name}
                            </div>
                            <ChevronRightIcon
                              className={clsx(
                                'h-4 w-4 transition-transform duration-200 text-gray-400',
                                open ? 'rotate-90' : ''
                              )}
                            />
                          </Disclosure.Button>
                          <Disclosure.Panel className="space-y-1">
                            {item.children.map((child) => (
                              <Link
                                key={child.name}
                                href={child.href}
                                className={clsx(
                                  'flex items-center py-2 pl-10 pr-3 text-sm rounded-md transition-colors duration-200',
                                  isCurrentPath(child.href)
                                    ? 'bg-immigration-100 text-immigration-900 font-medium border-r-2 border-immigration-500'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                )}
                              >
                                {child.name}
                              </Link>
                            ))}
                          </Disclosure.Panel>
                        </>
                      )}
                    </Disclosure>
                  ) : (
                    <Link
                      href={item.href}
                      className={clsx(
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                        isCurrentPath(item.href)
                          ? 'bg-immigration-100 text-immigration-900 border-r-2 border-immigration-500'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      )}
                    >
                      <item.icon 
                        className={clsx(
                          'mr-3 h-5 w-5 flex-shrink-0',
                          isCurrentPath(item.href)
                            ? 'text-immigration-500'
                            : 'text-gray-400 group-hover:text-gray-500'
                        )}
                        aria-hidden="true" 
                      />
                      {item.name}
                    </Link>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="lg:pl-64 flex flex-col flex-1">
        <div className="sticky top-0 z-10 flex h-16 bg-white border-b border-gray-200 lg:border-none">
          <button
            type="button"
            className="border-r border-gray-200 px-4 text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-immigration-500 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>
          
          {/* Search bar */}
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex">
              <div className="w-full flex md:ml-0">
                <label htmlFor="search-field" className="sr-only">
                  Search
                </label>
                <div className="relative w-full text-gray-400 focus-within:text-gray-600">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    id="search-field"
                    className="block w-full h-full pl-8 pr-3 py-2 border-transparent text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-0 focus:border-transparent sm:text-sm"
                    placeholder="Search cases, users, or services..."
                    type="search"
                    name="search"
                  />
                </div>
              </div>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
              <button
                type="button"
                className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-immigration-500"
              >
                <span className="sr-only">View notifications</span>
                <BellIcon className="h-6 w-6" aria-hidden="true" />
              </button>

              {/* Profile dropdown */}
              <Menu as="div" className="ml-3 relative">
                <div>
                  <Menu.Button className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-immigration-500">
                    <span className="sr-only">Open user menu</span>
                    <div className="h-8 w-8 rounded-full bg-immigration-100 flex items-center justify-center">
                      <UserGroupIcon className="h-5 w-5 text-immigration-600" />
                    </div>
                  </Menu.Button>
                </div>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                    {userNavigation.map((item) => (
                      <Menu.Item key={item.name}>
                        {({ active }) => (
                          <Link
                            href={item.href}
                            className={clsx(
                              active ? 'bg-gray-100' : '',
                              'block px-4 py-2 text-sm text-gray-700'
                            )}
                          >
                            {item.name}
                          </Link>
                        )}
                      </Menu.Item>
                    ))}
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          </div>
        </div>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
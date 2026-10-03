(function () {
  const api = window.PluginApi;
  const React = api.React;
  const { Dropdown } = api.libraries.Bootstrap;
  const { useLocation } = api.libraries.ReactRouterDOM;
  const h = React.createElement;

  function flatten(children) {
    return React.Children.toArray(children).flatMap(child =>
      child.type === React.Fragment ? flatten(child.props.children) : [child]);
  }

  function Navigation({ children, render, ...props }) {
    const location = useLocation();
    const items = flatten(children);
    const primary = items.filter(child => ['/scenes', '/images', '/performers'].includes(child.props.eventKey));
    const secondary = items.filter(child => !primary.includes(child));
    const active = secondary.some(child => location.pathname === child.props.eventKey ||
      location.pathname.startsWith(child.props.eventKey + '/'));
    return h('div', { className: 'minimal-navigation' }, render({ ...props, children: [
      ...primary,
      secondary.length > 0 && h(Dropdown, { key: 'more', className: 'minimal-nav-more' },
        h(Dropdown.Toggle, { variant: 'link', className: 'minimal' + (active ? ' active' : ''), id: 'minimal-nav-more' }, 'More'),
        h(Dropdown.Menu, null, secondary.map(child => h(Dropdown.Item, { as: 'div', key: child.props.eventKey }, child))))
    ] }));
  }

  function UtilityMenu({ children, render, ...props }) {
    const items = flatten(children);
    const isSecondary = child => child.props.to === '/stats' ||
      child.props.href === 'https://opencollective.com/stashapp' ||
      (typeof child.props.href === 'string' && child.props.href.endsWith('/logout')) ||
      (child.type === api.libraries.Bootstrap.Button && typeof child.props.onClick === 'function');
    const secondary = items.filter(isSecondary);
    const primary = items.filter(child => !isSecondary(child));

    function menuItem(child, index) {
      const inner = React.isValidElement(child.props.children) ? child.props.children : child;
      const label = inner.props.title;
      const icon = React.Children.toArray(inner.props.children)[0];
      const content = React.cloneElement(inner, {}, icon, h('span', null, label));
      const item = inner === child ? content : React.cloneElement(child, {}, content);
      return h(Dropdown.Item, { as: 'div', key: index }, item);
    }

    return render({ ...props, children: [...primary,
      secondary.length > 0 && h(Dropdown, { key: 'actions', className: 'minimal-utility-menu' },
        h(Dropdown.Toggle, { variant: 'link', className: 'minimal', 'aria-label': 'More actions', title: 'More actions' },
          h(api.components.Icon, { icon: api.libraries.FontAwesomeSolid.faEllipsisH })),
        h(Dropdown.Menu, { align: 'right' }, secondary.map(menuItem)))
    ] });
  }

  function SceneFocus({ render, ...props }) {
    React.useLayoutEffect(() => {
      props.setCollapsed(true);
    }, [props.scene.id, props.setCollapsed]);
    const content = render(props);
    const children = React.Children.map(content.props.children, child => {
      if (!React.isValidElement(child)) return child;
      if (child.props.className?.split(' ').includes('scene-tabs')) {
        return React.cloneElement(child, { id: 'minimal-scene-details' });
      }
      if (child.props.className?.split(' ').includes('scene-divider')) {
        const toggle = React.cloneElement(child.props.children, {
          'aria-label': props.collapsed ? 'Show scene details' : 'Hide scene details',
          'aria-expanded': !props.collapsed,
          'aria-controls': 'minimal-scene-details',
          title: props.collapsed ? 'Show scene details' : 'Hide scene details'
        });
        return React.cloneElement(child, { className: 'scene-divider minimal-scene-divider' }, toggle);
      }
      return child;
    });
    return React.cloneElement(content, {}, children);
  }

  function replace(name, component) {
    api.patch.instead(name, (...args) => h(component, { ...args[0], render: args[args.length - 1] }));
  }
  replace('MainNavBar.MenuItems', Navigation);
  replace('MainNavBar.UtilityItems', UtilityMenu);
  replace('ScenePage', SceneFocus);
})();

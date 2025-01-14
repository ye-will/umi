// @ts-ignore
import React, { useMemo } from 'react';
import {
  generatePath,
  Navigate,
  useParams,
  useLocation,
  useNavigate,
  Outlet,
} from 'react-router-dom';
import { RouteContext, useRouteData } from './routeContext';
import { IClientRoute, IRoute, IRoutesById } from './types';

export function createClientRoutes(opts: {
  routesById: IRoutesById;
  routeComponents: Record<string, any>;
  parentId?: string;
  loadingComponent?: React.ReactNode;
  reactRouter5Compat?: boolean;
}) {
  const { routesById, parentId, routeComponents } = opts;
  return Object.keys(routesById)
    .filter((id) => routesById[id].parentId === parentId)
    .map((id) => {
      const route = createClientRoute({
        route: routesById[id],
        routeComponent: routeComponents[id],
        loadingComponent: opts.loadingComponent,
        reactRouter5Compat: opts.reactRouter5Compat,
        ...(opts.reactRouter5Compat && {
          // TODO: 这个不准，没考虑 patchClientRoutes 的场景
          hasChildren:
            Object.keys(routesById).filter(
              (rid) => routesById[rid].parentId === id,
            ).length > 0,
        }),
      });
      const children = createClientRoutes({
        routesById,
        routeComponents,
        parentId: route.id,
        loadingComponent: opts.loadingComponent,
        reactRouter5Compat: opts.reactRouter5Compat,
      });
      if (children.length > 0) {
        route.children = children;
        // TODO: remove me
        // compatible with @ant-design/pro-layout
        route.routes = children;
      }
      return route;
    });
}

function NavigateWithParams(props: { to: string }) {
  const params = useParams();
  const propsWithParams = {
    ...props,
    to: generatePath(props.to, params),
  };
  return <Navigate replace={true} {...propsWithParams} />;
}

function createClientRoute(opts: {
  route: IRoute;
  routeComponent: any;
  loadingComponent?: React.ReactNode;
  hasChildren?: boolean;
  reactRouter5Compat?: boolean;
}): IClientRoute {
  const { route } = opts;
  const { redirect, ...props } = route;
  const Remote = opts.reactRouter5Compat
    ? RemoteComponentReactRouter5
    : RemoteComponent;
  return {
    element: redirect ? (
      <NavigateWithParams to={redirect} />
    ) : (
      <RouteContext.Provider
        value={{
          route: opts.route,
        }}
      >
        <Remote
          loader={React.memo(opts.routeComponent)}
          loadingComponent={opts.loadingComponent || DefaultLoading}
          hasChildren={opts.hasChildren}
        />
      </RouteContext.Provider>
    ),
    ...props,
  };
}

function DefaultLoading() {
  return <div />;
}

function RemoteComponentReactRouter5(props: any) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { route } = useRouteData();
  const match = useMemo(() => {
    return {
      params,
      isExact: true,
      path: route.path,
      url: location.pathname,
    };
  }, [location.pathname, route.path, params]);
  const history = useMemo(() => {
    return {
      back: () => navigate(-1),
      goBack: () => navigate(-1),
      location: location,
      push: (url: string, state?: any) => navigate(url, { state }),
      replace: (url: string, state?: any) =>
        navigate(url, {
          replace: true,
          state,
        }),
    };
  }, [location, navigate]);

  // staticContext 没有兼容 好像没看到对应的兼容写法
  const Component = props.loader;

  return (
    <React.Suspense fallback={<props.loadingComponent />}>
      <Component
        location={location}
        match={match}
        history={history}
        params={params}
      >
        {props.hasChildren && <Outlet />}
      </Component>
    </React.Suspense>
  );
}

function RemoteComponent(props: any) {
  const Component = props.loader;
  return (
    <React.Suspense fallback={<props.loadingComponent />}>
      <Component />
    </React.Suspense>
  );
}

import * as fs from 'fs';
import * as path from 'path';

import { IStyleAPI, IStyleItem } from 'import-sort-style';

export default function (styleApi: IStyleAPI, baseFile): Array<IStyleItem> {
  const {
    and,
    member,
    moduleName,
    name,
    not,
    unicode,
    isInstalledModule,
    hasNoMember,
  } = styleApi;

  // inspired by https://github.com/4Catalyzer/import-sort-style-4catalyzer/blob/master/index.js
  const pathSort = (a, b) => {
    a = a.split(path.sep);
    b = b.split(path.sep);

    const maxLength = Math.max(a.length, b.length);

    for (let i = 0; i < maxLength; i += 1) {
      if (!(i in a)) {
        return -1;
      }

      if (!(i in b)) {
        return 1;
      }

      if (a[i].toUpperCase() > b[i].toUpperCase()) {
        return 1;
      }

      if (a[i].toUpperCase() < b[i].toUpperCase()) {
        return -1;
      }
    }

    return 0;
  }

  const isAngularModule = (imported) => Boolean(imported.moduleName.match(/^@angular\//));

  // Fallback for ESM-only packages (e.g. @sentry/angular, ngx-json-treeview) that lack a "main" field in package.json.
  // The default isInstalledModule uses resolve.sync() which fails for such packages.
  // This checks if the package directory physically exists in node_modules.
  const isEsmInstalledModule = (imported) => {
    const mod: string = imported.moduleName;
    
    if (mod.startsWith('.') || mod.startsWith('/')) {
      return false;
    }
    
    const scopedMatch: RegExpMatchArray | null = mod.match(/^(@[^\/]+\/[^\/]+)/);
    const packageName: string = scopedMatch ? scopedMatch[1] : mod.split('/')[0];
    
    let dir: string = path.dirname(path.resolve(baseFile));
    
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'node_modules', packageName))) {
        return true;
      }
      
      dir = path.dirname(dir);
    }
    
    return false;
  };

  const isThirdParty = (imported) => isInstalledModule(baseFile)(imported) || isEsmInstalledModule(imported);

  const isConfig = (imported) => (
    [
      '@env',
      '/env',
      '/environment',
      '/config',
      '-routes',
      '/routes'
    ].some((mask: string) => imported.moduleName.endsWith(mask))
  );

  return [

    // import {...} "@angular/...";
    {
      match: isAngularModule,
      sort: member(unicode),
      sortNamedMembers: name(unicode),
    },
    { separator: true },


    // third party modules
    // e.g.:
    //
    //    import { NgxPageScrollModule } from 'ngx-page-scroll';
    {
      match: and(not(isAngularModule), isThirdParty, not(hasNoMember)),
      sort: member(unicode),
      sortNamedMembers: name(unicode),
    },

    //    import 'moment/locale/en.js';
    {
      match: and(hasNoMember, isThirdParty),
      sort: moduleName(pathSort),
      sortNamedMembers: name(unicode),
    },
    { separator: true },


    // env, config, routes
    // e.g.:
    //
    //    import { appRoutes } from './routes';
    //    import { APP_TOKEN } from './config';
    //    import { environment } from '@env';
    {
      match: and(isConfig, not(isThirdParty)),
      sort: member(unicode),
      sortNamedMembers: name(unicode),
    },
    { separator: true },


    // local imports
    // e.g.:
    //
    //    import { AnotherComponent } from '../another/another.component';
    //    import { SomePipe } from '@app/shared/pipes/some.pipe';
    //    import { SomeComponent } from './components/some/some.component';
    {
      match: and(not(isConfig), not(isThirdParty), not(hasNoMember)),
      sort: member(unicode),
      sortNamedMembers: name(unicode),
    },

    //    import './my-lib.js';
    {
      match: and(hasNoMember, not(isThirdParty)),
      sort: moduleName(pathSort),
      sortNamedMembers: name(unicode),
    },
    { separator: true }
  ];
}
